# `DataSource` — configuration and lifecycle

`DataSource` replaced `Connection` in TypeORM 1.0. There is no global registry any more: you hold the instance and pass it.

```ts
export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Order, OrderLine],          // explicit imports, not globs
  migrations: [AddOrders1786701900000],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  extra: { max: 20, idleTimeoutMillis: 30_000 },   // passed through to pg.Pool
});

await dataSource.initialize();   // was connect()
// …
await dataSource.destroy();      // was close()
```

`dataSource.isInitialized` replaced `isConnected`.

## Entities: explicit imports over globs

The `entities` option accepts classes **and** glob path strings, and 1.0 swapped the glob engine to `tinyglobby` (documented as a drop-in replacement for most projects). Prefer the class array anyway:

- A glob resolves differently under `ts-node`, a compiled `dist/`, a bundler and a test runner. The failure mode is an **empty** entity list, which surfaces as "No metadata for X was found" far from the cause.
- An explicit array fails at compile time when a file moves.
- The array doubles as a readable inventory of what the data source owns.

The same argument applies to `migrations`, with one caveat: a long explicit migration list is churn on every migration. A glob is more defensible there — just make sure it resolves in the environment that runs migrations, and check the migrations table after the first run.

## Environment configuration is gone

`TYPEORM_*` environment variables and `ConnectionOptionsEnvReader` were removed in 1.0, and **`.env` files are no longer auto-loaded**. Load and validate configuration yourself. In a Nest application that means `forRootAsync` + `ConfigService` — see `engineering-paved-path:nestjs-best-practices`.

## Connection pooling

TypeORM does not implement pooling; it passes `extra` through to `pg`. So the defaults you are actually running are **node-postgres's**:

| Option | Default |
|---|---|
| `max` | 10 |
| `min` | 0 |
| `idleTimeoutMillis` | 10 000 |
| `connectionTimeoutMillis` | **0 — no timeout** |
| `maxUses` | Infinity |

Two of those deserve attention:

- **`connectionTimeoutMillis: 0` means a request waiting for a connection waits forever.** Under saturation you get hanging requests rather than fast failures, and the symptom looks like a slow database rather than an exhausted pool. Set it.
- **`max: 10` is per process.** Multiply by replicas, and by any worker/scheduler process, before comparing against the server's `max_connections`. Exhausting the server affects every application sharing it.

See [postgres-specifics.md](postgres-specifics.md) for the connection-pooler (PgBouncer / serverless) traps.

## Multiple data sources

Give every data source beyond the first an explicit `name`. An unnamed second registration overwrites the default one, and the failure surfaces as queries reaching the wrong database rather than as an error.

## Logging

`logging: true` logs everything, which in practice means nobody reads it. A useful default is `['error', 'warn', 'migration']` plus `maxQueryExecutionTime` to surface slow queries:

```ts
{ logging: ['error', 'warn', 'migration'], maxQueryExecutionTime: 200 }
```

Query logs contain **parameter values**. Treat them as sensitive: not in a shared log sink at `info` level, not in a support ticket, not in a screenshot.

## Behavioural options worth setting deliberately

- **`invalidWhereValuesBehavior`** — defaults to `"throw"` since 1.0. Previously `null`/`undefined` in a `where` were silently ignored, which meant a bug in the caller produced a query matching *everything*. The new default is the safe one; keep it, and use `IsNull()` when you mean "is null". Only relax it (`{ null: "ignore", undefined: "ignore" }`) as a deliberate, temporary migration aid.
- **`migrationsRun`** — leave it `false`; run migrations as a deploy step ([migrations.md](migrations.md)).
- **`cache`** — TypeORM's query cache is a separate store with its own invalidation problem. Do not turn it on to fix a slow query; fix the query or add an index.

## Where the `DataSource` may live

One instance per process, constructed at the composition root, injected everywhere else. Concretely: nothing above the repository layer holds it, and no repository constructs it. See `engineering-paved-path:onion-architecture` for the layering and `engineering-paved-path:nestjs-best-practices` for the injection.

A separate exported `DataSource` for the CLI (`typeorm migration:run -d src/data-source.ts`) is normal, and it is the file that must not import the application's module graph — a CLI entry point that boots the application to read its configuration is a circular dependency waiting for its first failing migration.

## Checklist

- [ ] `synchronize: false`.
- [ ] Entities imported explicitly.
- [ ] `connectionTimeoutMillis` set to something finite.
- [ ] Pool size × process count reconciled with the server's `max_connections`.
- [ ] `initialize()` awaited before any query; `destroy()` on shutdown.
- [ ] Named data sources when there is more than one.
