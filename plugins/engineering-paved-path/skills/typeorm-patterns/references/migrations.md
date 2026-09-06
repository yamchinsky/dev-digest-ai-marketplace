# Migrations

## `synchronize` is not a migration strategy

TypeORM's own documentation: *"it is unsafe to use `synchronize: true` for schema synchronization on production once you get data in your database."* Set `synchronize: false` and keep it there. The only defensible use is a throwaway database that is recreated per run.

## `migration:generate` vs `migration:create`

| Command | Produces |
|---|---|
| `migration:generate` | a migration diffed from your entities against the current database |
| `migration:create` | an empty scaffold you fill in |

Generation is a good starting point and a bad ending point. **What a differ proposes is not what you meant**, and the review pass is mandatory. Two systematic defects show up on real PostgreSQL schemas:

1. **A shared enum type is emitted once per column.** If two entities have a column of the same Postgres enum, the generated migration contains one `CREATE TYPE` (and one `DROP TYPE`) per column. Both `up()` and `down()` fail unedited.
2. **Anything the differ cannot see comes back as noise.** Constraints, foreign keys or indexes created by hand-written SQL in an earlier migration are invisible to the entity model, so every generate run proposes dropping and recreating them. Strip that — while remembering that genuinely new constraints of the same kind still have to be added by hand.

If your schema has enough hand-written SQL that generation is mostly noise, make it a policy: **hand-written migrations only**, with generation used as a *suggestion source* you read and discard.

## Hand-writing rules

```ts
export class AddOrders1786701900000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE orders (...)`);
    await q.query(`CREATE INDEX idx_orders_user ON orders (user_id)`);
    await q.query(`ALTER TABLE orders ADD CONSTRAINT fk_orders_user
                   FOREIGN KEY (user_id) REFERENCES users(id)`);   // FKs LAST
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders DROP CONSTRAINT fk_orders_user`);  // FKs FIRST
    await q.query(`DROP TABLE orders`);
  }
}
```

- **Foreign keys go last in `up()` and first in `down()`.** Anything else fails on dependency order the first time someone reverts.
- **`down()` must actually revert.** An empty or wrong `down()` is worse than no `down()`, because it will be trusted once.
- **One concern per migration.** A migration that adds a table *and* backfills it *and* changes an enum is three failure modes sharing a transaction.
- **Backfills belong in their own migration**, and large ones belong outside the migration entirely — a migration holding a lock while it rewrites ten million rows is an outage.

### `CHECK` constraints on arrays

```sql
-- ❌ admits the empty array it exists to forbid
CHECK (array_length(tags, 1) >= 1)

-- ✅
CHECK (cardinality(tags) >= 1)
```

`array_length('{}', 1)` returns **NULL**, not `0` — an empty array has no first dimension to measure. A `CHECK` whose expression is NULL is *satisfied*. The constraint correctly rejects every other bad shape, which is exactly what makes it dangerous: it looks like it works. `cardinality()` returns `0`.

## Transaction wrapping

Migrations run **inside a transaction by default**. The `--transaction` flag has three modes:

| Mode | Behaviour |
|---|---|
| `all` (default) | every pending migration in **one** transaction |
| `each` | one transaction per migration |
| `none` | no wrapping |

A per-migration `transaction = false` on `MigrationInterface` overrides the default, but only takes effect under `each` or `none`.

This matters for one PostgreSQL statement in particular: **`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.** PostgreSQL's own wording: *"A regular `CREATE INDEX` command can be performed within a transaction block, but `CREATE INDEX CONCURRENTLY` cannot."* A migration containing it fails under the default mode. Run that migration with `--transaction none` (or `each` plus `transaction = false` on it), and understand what you gave up: without wrapping, a failure leaves the migration half-applied.

See [postgres-specifics.md](postgres-specifics.md) for the enum equivalent of this trap.

## Running them

- **Not at application boot.** `migrationsRun: true` exists, and it means every replica races to run the same migration on deploy, and a failure becomes a crash loop rather than a failed deploy step. Run them as an explicit step.
- **Order matters against a content seed.** When new rows depend on a read-path change shipping in the same release, the order is **migrate → deploy → seed**. Rows become visible to the *old* code the instant the seed commits; there is no "waits for the deploy" in a database.

## Reverting

`migration:revert` reverts **the latest applied migration in the database**, not the one you just wrote. Against a shared database — several people, or several agents, working at once — that will happily revert somebody else's later-timestamped migration.

To verify a round trip, use a throwaway database:

```bash
createdb scratch_$$            # or CREATE DATABASE via psql
DATABASE_URL=…/scratch_$$ npm run migration:run
DATABASE_URL=…/scratch_$$ npm run migration:revert
DATABASE_URL=…/scratch_$$ npm run migration:run
dropdb scratch_$$
```

Leave the shared database fully migrated.

## Verify that it ran, not that the command exited

A wrapper script that swallows its arguments can print nothing and **exit 0** — a migration that never ran looks like a success, in CI too. (Package-manager argument forwarding is the usual culprit: a stray `--` that the runner passes through literally instead of consuming.) After any change to the migration scripts, check the migrations table, not the exit code:

```sql
SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;
```

## Checklist

- [ ] `synchronize: false`.
- [ ] Generated output reviewed line by line; enum and hand-written-SQL noise removed.
- [ ] FKs last in `up()`, first in `down()`.
- [ ] `down()` tested by an actual round trip on a scratch database.
- [ ] `CREATE INDEX CONCURRENTLY` (or `ALTER TYPE … ADD VALUE` plus a use) is not sharing a transaction with anything.
- [ ] Array `CHECK`s use `cardinality()`.
- [ ] A new owner-keyed table has its erasure step — see [soft-deletes.md](soft-deletes.md).
- [ ] Migrations run as a deploy step, before the deploy, with any content seed after it.
