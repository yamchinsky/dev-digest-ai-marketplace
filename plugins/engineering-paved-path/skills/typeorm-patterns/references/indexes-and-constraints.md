# Indexes and constraints at the entity boundary

This page is about **what TypeORM can express from an entity**, and where the line is that sends you to a hand-written migration. Which indexes you *should* have, and how to design them, is `engineering-paved-path:postgresql-table-design`.

## What the decorators cover

```ts
@Entity()
@Index(['workspaceId', 'createdAt'])                      // composite
@Index('idx_orders_open', ['workspaceId'], { where: 'status = \'open\'' })   // partial
@Unique(['workspaceId', 'externalId'])                    // unique constraint
export class Order {
  @Index()
  @Column({ type: 'uuid' })
  workspaceId!: string;
}
```

- `@Index` works on a column or on the entity (for composite indexes). Column order matters: **most selective first**, per the docs.
- `@Unique` is entity-level only, and it takes **property names, not database column names** — a mismatch here fails at schema-generation time, not at boot.
- PostgreSQL **partial** indexes (`where`) and simple string-expression indexes are supported.

## Where the decorators stop

The documented limit, verbatim: *"TypeORM does not support some index options and definitions (e.g. `lower`, `pg_trgm`) due to many database-specific differences"*, with the prescribed workaround: *"you should create the index manually (for example, in the migrations)."*

In practice, drop to a hand-written migration for:

- **Functional indexes** — `LOWER(email)`, `(data->>'key')`, any expression the differ cannot round-trip.
- **Non-btree index types** — GIN, GiST, BRIN, and everything that needs an operator class (`gin_trgm_ops`, `jsonb_path_ops`).
- **Extension-backed indexes** — `pg_trgm`, `btree_gin`; the extension itself also has to be created in a migration.
- **`CREATE INDEX CONCURRENTLY`** — and remember it cannot run inside a transaction, which collides with TypeORM's default migration wrapping ([migrations.md](migrations.md)).
- **`CHECK` constraints of any complexity**, and **`EXCLUDE`** constraints.
- **Deferrable constraints**, and anything with `NULLS NOT DISTINCT`.

Once an index is created by hand, the entity model cannot see it, so **every `migration:generate` run proposes dropping it.** That is the noise described in [migrations.md](migrations.md) — strip it, and consider whether the schema has crossed the threshold where generation is a suggestion source rather than a tool.

## Constraints belong in the database

An invariant enforced only in an entity lifecycle hook is enforced only on the paths that load an entity — `update()` bypasses hooks, and raw SQL bypasses everything. If an invariant matters, it is a constraint:

| Invariant | Where |
|---|---|
| "this pair is unique" | `UNIQUE` constraint — and it doubles as the `upsert`/`ON CONFLICT` target |
| "this value is one of a set" | enum type, or `CHECK` |
| "this array is non-empty" | `CHECK (cardinality(col) >= 1)` — **never** `array_length`, which returns NULL for `'{}'` and therefore passes |
| "this row must have a parent" | `FOREIGN KEY … NOT NULL` |
| "at most one active row per owner" | partial unique index |

The unique-constraint entry is the highest-leverage one: it is what makes idempotency claims and upserts possible at all ([raw-sql.md](raw-sql.md), [repository-api.md](repository-api.md)).

## The `CHECK`-that-looks-like-it-works trap

```sql
-- ❌ passes for '{}': array_length('{}', 1) is NULL, and a NULL CHECK is satisfied
CHECK (array_length(tags, 1) >= 1)

-- ✅ cardinality('{}') is 0
CHECK (cardinality(tags) >= 1)
```

What makes this expensive is its *partial* correctness — it rejects every other malformed value, so it looks like a working constraint in review and in every test that does not try the empty array. Only an integration test that inserts `'{}'` and expects a rejection catches it.

## Composite and covering indexes

Index column order follows the query, not the entity:

- An index on `(a, b)` serves `WHERE a = ?` and `WHERE a = ? AND b = ?`; it does **not** serve `WHERE b = ?`.
- For keyset pagination, index exactly the `ORDER BY` tuple, including the tiebreaker: `(workspace_id, created_at DESC, id DESC)`.
- Foreign key columns are not indexed automatically by PostgreSQL. A missing index there shows up as slow deletes on the parent, not slow reads.

Adding an index to a hot table is a lock. On anything with real volume, `CREATE INDEX CONCURRENTLY` in its own untransacted migration is the answer.

## Verify, do not assume

```sql
\d+ orders                    -- what actually exists
EXPLAIN ANALYZE SELECT …      -- whether it is actually used
```

An index that the planner declines to use — wrong order, wrong type, low selectivity, a function applied to the column in the predicate — is pure write-cost. Check before and after.

## Checklist

- [ ] Unique constraints exist for every upsert/`ON CONFLICT` target.
- [ ] Foreign key columns are indexed.
- [ ] Functional / GIN / trigram / concurrent indexes live in hand-written migrations, and the resulting generate-noise is understood.
- [ ] Array `CHECK`s use `cardinality()`.
- [ ] Invariants that must always hold are constraints, not entity hooks.
- [ ] New index verified with `EXPLAIN ANALYZE`, not assumed.
