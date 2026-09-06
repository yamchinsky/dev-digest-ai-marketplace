# Repository API — `save` vs `insert` vs `upsert` vs `update`

Four ways to write a row, with materially different costs and side effects. Choosing by habit is how a hot path acquires an unnecessary `SELECT` per write.

| Call | Loads first? | Cascades | Subscribers / lifecycle hooks | Use for |
|---|---|---|---|---|
| `save(entity)` | **Yes** — SELECTs to decide insert vs update | Yes | Yes | persisting an aggregate you are holding |
| `insert(values)` | No | No | No | a known-new row, especially in bulk |
| `upsert(values, { conflictPaths })` | No | No | No | insert-or-update on a unique key |
| `update(criteria, patch)` | No | No | **No** | a targeted field change by condition |

## `save()` — convenient, and not free

The documented behaviour: *"if the entity already exist in the database, it is updated. If the entity does not exist in the database, it is inserted."* To decide which, it issues a `SELECT` first, and it walks the cascade graph.

That makes it the right call for "I have loaded an aggregate, changed it, and want it persisted" — and the wrong call for a bulk insert of ten thousand rows, or for incrementing a counter.

Two behaviours that surprise people:

- **A partial object is a partial update, not a reset.** `save({ id, name })` updates `name` and leaves everything else alone. That is usually what you want, and it is also why a "clear this field" bug shows up as *nothing happening* — you have to pass `null` explicitly.
- **Cascades only reach loaded relations.** TypeORM traverses relations that are populated on the object. A cascade-remove for a relation you never loaded silently does nothing.

## `update()` does not run subscribers

`update()` never instantiates an entity, so `@BeforeUpdate`, `@AfterUpdate` and subscribers do not fire, and neither do column transformers on the read side. If any invariant of your entity lives in a lifecycle hook, `update()` bypasses it.

This is a genuine argument for keeping invariants in the database (constraints, triggers, generated columns) rather than in entity hooks: a hook is only enforced on the paths that happen to load an entity.

## `upsert()`

```ts
await repo.upsert(rows, {
  conflictPaths: ['userId', 'localDate'],
  skipUpdateIfNoValuesChanged: true,
});
```

- `conflictPaths` must be backed by a **unique constraint or index**. Without one, PostgreSQL has no conflict target and the statement errors.
- `skipUpdateIfNoValuesChanged` emits a `WHERE … IS DISTINCT FROM EXCLUDED` guard, so unchanged rows are not rewritten — which matters for `updated_at` columns, triggers and replication volume.
- Supported on PostgreSQL, MySQL, SQLite and CockroachDB.

For "insert if absent, tell me whether I won" — the idempotency-claim shape — raw `INSERT … ON CONFLICT DO NOTHING RETURNING` is clearer, because the empty result *is* the answer. See [raw-sql.md](raw-sql.md).

## Seeding is upsert-shaped, and that has a trap

An idempotent seeder that upserts on a natural key never removes anything. A row deleted from the fixture **stays in the table** and keeps being served, indistinguishable from current content.

Deleting the leftovers is usually not the fix either: other tables reference them. The honest options are to warn loudly with the exact list of orphans, or to add an `active` flag to the table — a deliberate schema change, not something a seeding script should improvise.

## Find options

```ts
await repo.find({
  where: { workspaceId, status: In(['open', 'pending']) },
  relations: { customer: true },        // object syntax — string arrays removed in 1.0
  select: { id: true, total: true },    // object syntax
  order: { createdAt: 'DESC' },
  take: 20,
  skip: 40,
});
```

- **String-array `select` / `relations` were removed in 1.0.** Object syntax only.
- **`join` in find options was removed** — use `relations`.
- **`findOneById` and `findByIds` are gone** → `findOneBy({ id })` and `findBy({ id: In([...]) })`.
- **`exist()` was renamed `exists()`**.
- `where` as an array is `OR`; nested objects filter on relations.
- `null` or `undefined` in a `where` now **throws** by default — use `IsNull()` ([data-source.md](data-source.md)).

## Repository vs `EntityManager`

`Repository<T>` is an `EntityManager` bound to one entity. Use the repository for single-entity work; reach for the manager when a unit of work spans entities — which in practice means inside a transaction, where you are handed one ([transactions.md](transactions.md)).

Custom repositories changed in 1.0: `AbstractRepository`, `@EntityRepository` and `getCustomRepository()` are removed. Extend instead:

```ts
export const OrderRepository = dataSource.getRepository(Order).extend({
  findOpenFor(userId: string) {
    return this.findBy({ userId, status: 'open' });
  },
});
```

In a Nest application the more common shape is a plain `@Injectable()` class holding an injected `Repository<T>` — it keeps the ORM behind a class you own and can mock. See `engineering-paved-path:nestjs-best-practices`.

## Counting queries in a test

`EntityManager` caches one repository instance per entity target, so spying on `dataSource.getRepository(Entity)` intercepts the production code path — a cheap N+1 regression test with no query logger:

```ts
const spy = jest.spyOn(dataSource.getRepository(Item), 'find');
```

Assert **flatness** (the count does not grow as the fixture doubles), never a hardcoded number: the spy catches every `find()` on that repository, so two unrelated queries on the same entity both count.

## Checklist

- [ ] Bulk writes use `insert`/`upsert`, not `save` in a loop.
- [ ] `upsert` conflict paths are backed by a real unique constraint.
- [ ] Nothing relies on a lifecycle hook that `update()` bypasses.
- [ ] Object syntax for `select`/`relations` (1.x requirement).
- [ ] `IsNull()` rather than a bare `null` in `where`.
