# PostgreSQL specifics the ORM does not handle

Things that are true of PostgreSQL and `node-postgres` regardless of what TypeORM does — and that TypeORM will not warn you about. For schema *design* see `engineering-paved-path:postgresql-table-design`.

## Type parsing: what you actually get back

`node-postgres` decides the JavaScript type, and two of its decisions surprise people.

### `bigint` and `numeric` come back as strings

`int8` and `numeric` are returned as **JS strings, by design**: JavaScript's `number` is an IEEE-754 double and cannot represent the full 64-bit integer range, nor arbitrary-precision numerics, without silent precision loss.

```ts
const [row] = await dataSource.query('SELECT count(*) FROM orders');
row.count            // "1234"  ← string
Number(row.count)    // fine here; not fine for an id or a money amount
```

Consequences:

- **Type the entity property as `string`** for `bigint`/`numeric` columns, and convert at the boundary where you know the safe range. Typing it `number` is a lie the compiler cannot catch, because the driver's value is untyped at that seam.
- `SUM()`, `COUNT()` and friends return `numeric`/`int8` — so an aggregate is a string too. `sum + 1` silently concatenates.
- Overriding this globally with `pg.types.setTypeParser` is possible and is a decision about accepting precision loss everywhere. Prefer converting locally.

### Dates and timezones

- **`timestamp` (without time zone) and `DATE` are parsed into a JS `Date` in the Node process's local timezone.** node-postgres's own documentation recommends `TIMESTAMPTZ` instead, warning that *"inserting a time from a process in one timezone and reading it out in a process in another timezone can cause unexpected differences."*
- **Use `timestamptz` for every moment in time.** It is stored as UTC and rendered in the session timezone; the round trip is unambiguous.
- **For a `DATE` column read through raw SQL**, TypeORM's column transforms do not apply, so you get a `Date` built in local time. Convert with `getFullYear()`/`getMonth()`/`getDate()` — **never** `toISOString()`, which shifts a day for any process east of UTC. Binding a `'YYYY-MM-DD'` string as a *write* parameter is safe.

A calendar date is not a moment. If the value is "the day this happened for the user", store `DATE`, resolve it in the user's timezone at the edge, and keep the API in `'YYYY-MM-DD'` strings.

## Enums

PostgreSQL enums are a type, not a constraint, and their mutability is limited by PostgreSQL — not by TypeORM.

- **Adding a value:** `ALTER TYPE … ADD VALUE [IF NOT EXISTS] … [BEFORE | AFTER …]`. TypeORM 1.0 emits this directly for entity enum additions instead of the old rename/recreate/drop sequence.
- **The trap:** it can run inside a transaction, but *"the new value cannot be used until after the transaction has been committed."* A migration that adds a value **and then inserts a row using it** fails. Split into two migrations, or run untransacted.
- **Removing a value:** there is **no `DROP VALUE`.** Removal requires the full dance — rename the old type, create the new one, alter every column to it, drop the old — by hand.
- **Renaming a value:** `ALTER TYPE … RENAME VALUE … TO …` exists, and does not renumber anything.

A shared enum used by columns on two or more entities is also the thing that makes generated migrations wrong ([migrations.md](migrations.md)).

If the value set changes often, a lookup table or `text` + `CHECK` costs less over time than an enum type.

### Casting in `CASE`

```sql
-- ❌ "column is of type task_status but expression is of type text"
UPDATE tasks SET status = CASE WHEN x THEN $1 ELSE $2 END

-- ✅
UPDATE tasks SET status = CASE WHEN x THEN $1::task_status ELSE $2::task_status END
```

A bare `col = $1` infers the column's type; a `CASE` takes its type from its branches, and an untyped placeholder defaults to `text`.

## `CREATE INDEX CONCURRENTLY` cannot be transacted

PostgreSQL, verbatim: *"A regular `CREATE INDEX` command can be performed within a transaction block, but `CREATE INDEX CONCURRENTLY` cannot."*

TypeORM wraps the whole migration run in one transaction by default, so the two collide. Run that migration with `--transaction none` (or `each` plus `transaction = false`), and accept that a failure leaves it half-applied — a concurrently-built index that fails leaves an **invalid** index behind that must be dropped explicitly.

## `date_trunc()` and `time` columns

`date_trunc()` accepts `timestamp`, `timestamptz` and `interval` — **never a bare `time` column**. Replicating an "hour equal and minute equal, ignore seconds" rule against a `time` column needs paired `EXTRACT(HOUR …)` / `EXTRACT(MINUTE …)` comparisons.

More generally, per-row time arithmetic in SQL means one malformed row can abort the whole query. Doing the comparison in application code after a coarser SQL filter is often the more robust split.

## Connection pooling

TypeORM passes `extra` straight through to `pg.Pool`, so `pg`'s defaults are yours ([data-source.md](data-source.md)). Two deployment shapes need explicit attention:

### Serverless / autoscaled runtimes

Each instance owns a pool. `max: 10` × 50 concurrent instances is 500 connections against a server whose `max_connections` is probably 100. Either cap the pool at 1–2 per instance and put a pooler in front, or use a driver designed for the shape.

### PgBouncer in transaction pooling mode

In transaction pooling, consecutive transactions on the same client connection can land on **different backend processes**. Anything that lives on a server-side session therefore does not survive: named prepared statements, session-level `SET`, advisory locks held across statements, `LISTEN`/`NOTIFY`, temporary tables.

The symptom is intermittent `prepared statement "..." does not exist`. The fix is to disable server-side prepared statements at the driver level, or to run the pooler in session mode for that connection.

> Verify the exact driver flag against your `pg` version before relying on it — this is a widely-reported behaviour rather than something stated in a TypeORM doc page, and the knob has moved between `pg` majors.

## `LEAST`/`COALESCE` over correlated columns

A guard worth internalising, because it produces a query that is *silently wrong* rather than failing: if one column can only ever be later than another — because a foreign key forces the child row to exist after its parent — then `LEAST(child_ts, parent_ts)` collapses to `parent_ts` for every row. The expression looks like it encodes a rule; it encodes nothing.

Before shipping an ordering built from two timestamps, state the invariant between them out loud. If one always dominates, the expression is a no-op and the ordering is not what the name says.

## Testing against a real database

None of this page is reachable from a mocked repository. A database-backed lane is not a nice-to-have here; it is the only way to observe driver return types, constraint behaviour, enum casts and soft-delete SQL. See `engineering-paved-path:nestjs-best-practices` for the lane split and its cross-suite traps.
