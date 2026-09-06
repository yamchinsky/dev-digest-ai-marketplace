# QueryBuilder

The query builder is the escape hatch below find options and above raw SQL. It is also where several of TypeORM's implicit behaviours **stop applying**, which is the reason to read this page before reaching for it.

## What the query builder does *not* do

| Behaviour | `find*` | `createQueryBuilder` |
|---|---|---|
| Excludes soft-deleted **root** rows | yes | **no** |
| Excludes soft-deleted **joined** rows | yes | yes (but see the ordering bug in [soft-deletes.md](soft-deletes.md)) |
| Loads `eager: true` relations | yes | **no** |
| Applies column transformers on hydration | yes | yes for `getMany`, **no** for `getRawMany` |

The eager-relation exclusion is documented outright: *"eager relations only work when you use `find*` methods. If you use `QueryBuilder` eager relations are disabled and have to use `leftJoinAndSelect` to load the relation."* So a refactor from `find` to `createQueryBuilder` silently drops relations the calling code still expects — and the failure is `undefined` on a property, far from the query.

## `take`/`skip` vs `limit`/`offset`

Straight from the docs: *"`take` and `skip` may look like we are using `limit` and `offset`, but they aren't. `limit` and `offset` may not work as you expect once you have more complicated queries with joins or subqueries. Using `take` and `skip` will prevent those issues."*

The mechanism: a join to a to-many relation multiplies parent rows. `LIMIT 20` then limits **joined rows**, so you get some number of parents fewer than 20, and the page boundary lands mid-parent. `take`/`skip` restructure the query (a subquery selecting distinct parent ids) so the limit applies to entities.

**Use `take`/`skip` whenever the query joins anything.** `limit`/`offset` are correct only for a flat, join-free query — and since a query rarely stays join-free, defaulting to `take`/`skip` costs nothing.

Separately: `OFFSET` is O(offset) at the database level. Past a few pages, keyset (cursor) pagination on an indexed, monotone column is the fix, not a bigger offset:

```ts
qb.where('o.createdAt < :cursor', { cursor })
  .orderBy('o.createdAt', 'DESC')
  .take(limit);
```

Make sure the ordering column is indexed and that ties are broken deterministically (`createdAt DESC, id DESC`), otherwise a page boundary between equal timestamps skips or repeats rows.

## `getMany` vs `getRawMany`

Different shapes, not different names:

```ts
const orders = await qb.getMany();      // Order[] — hydrated entities, relations mapped
const rows   = await qb.getRawMany();   // plain objects, aliased columns: { o_id, o_total, sum }
```

- `getMany()` deduplicates parent rows produced by joins and maps relations. Use it when you want entities.
- `getRawMany()` returns driver rows with alias-prefixed keys. Use it for aggregates and projections — and remember that no transformer, no relation mapping and no soft-delete hydration applies.
- `getRawAndEntities()` gives both when you need an aggregate alongside the entity (a computed count, a distance).

A common bug: selecting an aggregate with `addSelect` and then calling `getMany()`. The aggregate is not on the entity, so it silently disappears. Use `getRawAndEntities()`.

## Parameters

```ts
qb.where('o.status = :status', { status })          // ✅ bound
  .andWhere('o.total > :min', { min });

qb.where(`o.status = '${status}'`);                 // ❌ injection
```

Parameter names are **shared across the whole builder**. Reusing `:id` for two different values in a composed query silently overwrites the first. Prefix them when composing (`:orderId`, `:userId`).

For a set: `.where('o.id IN (:...ids)', { ids })` — note the spread syntax. An empty array produces invalid SQL, so guard it.

## Subqueries

```ts
qb.where((sub) => {
  const q = sub.subQuery()
    .select('l.orderId')
    .from(OrderLine, 'l')
    .where('l.sku = :sku')
    .getQuery();
  return `o.id IN ${q}`;
}, { sku });
```

Verbose, and worth it only when the alternative is two round trips. Past a certain complexity, a raw query in the repository is more readable than a builder expression — that is a legitimate choice, not a defeat, as long as it stays in the repository ([raw-sql.md](raw-sql.md)).

## Locking

```ts
qb.setLock('pessimistic_write').setOnLocked('skip_locked');
```

The 1.0 removals matter here: the deprecated modes `pessimistic_partial_write` and `pessimistic_write_or_fail` are gone, replaced by `pessimistic_write` plus `.setOnLocked('skip_locked' | 'nowait')`.

`skip_locked` is the queue-consumer pattern: several workers each claim a different row without blocking. It only makes sense inside a transaction — a lock outside one is released immediately.

## Removed in 1.0

- `printSql()` → `getSql()` / `getQueryAndParameters()`
- `onConflict()` → `orIgnore()` / `orUpdate()`
- the **object overload** of `orUpdate()` → array form only
- `setNativeParameters()` → `setParameters()`
- the `WhereExpression` type alias → `WhereExpressionBuilder`

## Debugging

`getQueryAndParameters()` returns the SQL and the bound values — paste both into `EXPLAIN ANALYZE` rather than guessing at the plan. If the generated SQL is not what you expected, that is the answer; if it is, the problem is an index and belongs to `engineering-paved-path:postgresql-table-design`.

## Checklist

- [ ] Soft-delete predicate on the root, explicitly.
- [ ] Eager relations replaced by explicit `leftJoinAndSelect`.
- [ ] `take`/`skip`, not `limit`/`offset`, wherever a join exists.
- [ ] Every value bound; parameter names unique across the composed builder.
- [ ] `getRawMany()` used knowingly, not because `getMany()` "lost" a column.
