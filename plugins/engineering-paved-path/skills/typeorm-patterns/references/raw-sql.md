# Raw SQL — `query()`, result shapes, and what it bypasses

Raw SQL is a legitimate tool: atomic conditional updates, `ON CONFLICT` claims, window functions, recursive CTEs, and anything the query builder cannot express. What makes it dangerous in TypeORM is not the SQL — it is the **return value**.

## Parameterisation

PostgreSQL uses positional `$1, $2, …`:

```ts
const rows = await dataSource.query(
  'SELECT id, email FROM users WHERE workspace_id = $1 AND deleted_at IS NULL',
  [workspaceId],
);
```

The syntax differs per driver (`?` for MySQL/SQLite, `:1` for Oracle, `@0` for MSSQL), which the docs warn about explicitly. **Never** interpolate a value into the string — parameter binding is the only injection defence here, and there is no schema layer above it to catch a mistake.

## The result shape depends on the statement kind

This is the single most expensive undocumented behaviour in TypeORM. Observed on **TypeORM 1.x with the `pg` driver**, verified by database-backed tests after it caused three separate production bugs:

| Statement | Returns |
|---|---|
| `SELECT …` | plain array of row objects |
| `INSERT … RETURNING …` (with or without `ON CONFLICT`) | **plain array of rows** |
| `UPDATE … RETURNING …` | **`[rows, affectedCount]` tuple** |
| `DELETE … RETURNING …` | **`[rows, affectedCount]` tuple** |

So the destructure that is right for an `UPDATE` is wrong for an `INSERT`:

```ts
// ✅ UPDATE — tuple
const [rows, affected] = await dataSource.query(
  'UPDATE wallets SET balance = balance - $2 WHERE user_id = $1 AND balance >= $2 RETURNING balance',
  [userId, amount],
);

// ✅ INSERT — plain array
const rows = await dataSource.query(
  'INSERT INTO claims (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
  [userId, day],
);
```

**Copying an `UPDATE` method's destructure into an `INSERT` method fails in two ways, both bad:**

- **Zero rows returned** (the `ON CONFLICT DO NOTHING` case — the interesting one): `const [rows] = …` makes `rows` `undefined`, and `rows[0]` **throws**. Inside a caller's transaction that throw rolls back everything else in the transaction.
- **One row returned:** `rows` is the row object itself, so `rows[0]` is `undefined` and the method silently reports "nothing claimed" — *after* the insert has already committed.

The throw is the more dangerous half, because it converts a claim helper into a request-killer for every caller on that path.

Two defences, both cheap:

1. **Match the destructure to the statement kind**, and say so in a comment at the call site. A generic helper (`runReturningUpdate`, `runReturningInsert`) that encodes the shape once is better than the comment.
2. **Pin it with a database-backed test.** A repository spec that mocks the query result locks in whatever shape its author assumed — a spec written around the bug will pass while every real request fails. Only a real database proves a driver's shape.

The result is typed by whatever generic you assert, so **TypeScript cannot catch any of this.**

### `EntityManager.query()` delegates verbatim

`EntityManager.query()` forwards to `DataSource.query()` with its own query runner, so the shapes above hold identically inside and outside a transaction. That is what makes threading an optional `EntityManager` through raw-SQL repository methods safe:

```ts
async claim(key: string, manager?: EntityManager) {
  const rows = await (manager ?? this.dataSource).query(
    'INSERT INTO claims (key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
    [key],
  );
  return rows[0]?.id ?? null;
}
```

> **Undocumented.** TypeORM's docs specify the parameter syntax but not the return shape, and community reports also describe raw `UPDATE`/`DELETE` **without** `RETURNING` coming back as an empty array on PostgreSQL rather than an affected-row count. Treat the table above as "true in a real project on TypeORM 1.x + pg 8" and verify against your own version in a database-backed test before relying on it. There is no doc page to appeal to.

## What raw SQL bypasses

Everything the ORM layers on top, because those live in the repository and query-builder layers, not in the database:

- **Column transformers.** A `transformer` on an entity column runs on the repository path only.
- **Entity subscribers and listeners.** `@BeforeInsert`, `@AfterLoad` and friends never fire.
- **Soft-delete filtering.** `deleted_at IS NULL` is added by the ORM, so raw SQL returns soft-deleted rows unless you write the predicate yourself. See [soft-deletes.md](soft-deletes.md).
- **Naming strategy.** You are writing database column names, not entity property names. `deletedAt` in a raw query is a syntax error waiting for the first person who copies it from a query-builder call.

### Date columns come back different

The transformer bypass has one consequence that produces off-by-one-day bugs rather than errors:

`SELECT some_date_col` through `dataSource.query()` yields a JS `Date` constructed **in the process's local timezone**, because `node-postgres` parses `DATE`/`timestamp` that way and no TypeORM transform runs. Convert with local getters (`getFullYear`/`getMonth`/`getDate`), **never** `toISOString()` — the latter shifts a day behind UTC for any process east of Greenwich.

Binding a `'YYYY-MM-DD'` string as a *write* parameter is safe. See [postgres-specifics.md](postgres-specifics.md) for the wider type-parsing story.

## Patterns worth writing raw

### Atomic conditional update instead of read-then-write

```sql
UPDATE wallets
   SET balance = balance - $2
 WHERE user_id = $1 AND balance >= $2
RETURNING balance
```

A zero-row result *is* the rejection. The alternative — read the balance, decide in JavaScript, write — is a lost-update race under any concurrency, and no isolation level below `SERIALIZABLE` saves it.

### Idempotency as a unique constraint

```sql
INSERT INTO daily_push_log (user_id, local_date)
VALUES ($1, $2)
ON CONFLICT (user_id, local_date) DO NOTHING
RETURNING id
```

Zero rows means "already claimed". This survives restarts, concurrent schedulers and duplicate deliveries in a way no in-memory guard does — and it is the only form that works across replicas.

Note the deliberate trade in claim-before-act: the day is claimed *before* the side effect runs, so a total downstream outage does not retry. Claiming after the side effect trades that for double-sends. Pick knowingly and write down which you picked.

### Casting enum branches

```sql
-- ❌ "column is of type completion_status but expression is of type text"
UPDATE plans SET status = CASE WHEN x THEN $1 ELSE $2 END

-- ✅ every branch cast
UPDATE plans SET status = CASE WHEN x THEN $1::completion_status ELSE $2::completion_status END
```

A bare `col = $1` infers the column's type; a `CASE` takes its type from its branches, and an untyped placeholder defaults to `text`. Only a database-backed test catches this — a mocked repository passes happily.

## Checklist

- [ ] Every value is a bound parameter.
- [ ] The destructure matches the statement kind (or goes through a shape-encoding helper).
- [ ] Soft-delete predicates written explicitly where the table has them.
- [ ] Database column names, not entity property names.
- [ ] Date values converted with local getters, not `toISOString()`.
- [ ] A database-backed test pins the result shape.
