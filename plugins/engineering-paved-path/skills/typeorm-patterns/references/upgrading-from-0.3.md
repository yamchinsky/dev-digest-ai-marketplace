# Upgrading from 0.3.x to 1.x

> **This page describes an upgrade; it does not ask for one.** 0.3.x is still
> maintained and still widely deployed, and a major ORM bump is its own
> project with its own review — never a step taken on the way to something
> else. If the project is on 0.3.x and staying there, read the list below as
> a **description of what your code does today**: every "changed in 1.0" is a
> statement about the behaviour you currently have.

TypeORM 1.0.0 shipped **2026-05-19**; the line is at **1.1.1** (2026-09-01). It was the first breaking release in about five years, so a codebase on 0.3.x has a real migration ahead — and so does anyone's memory of the API.

Official material: [Upgrading from 0.3 to 1.0](https://typeorm.io/docs/releases/1.0/upgrading-from-0.3/) and the [1.0 release notes](https://typeorm.io/docs/releases/1.0/release-notes/). There is a codemod:

```bash
npx @typeorm/codemod v1 src/
```

Run it, then read every hunk. It handles the mechanical renames, not the behavioural changes — and the behavioural changes are the ones that ship silently.

## `Connection` → `DataSource`

| 0.3.x | 1.x |
|---|---|
| `Connection` | `DataSource` |
| `ConnectionOptions` | `DataSourceOptions` |
| `BaseConnectionOptions` | `BaseDataSourceOptions` |
| `MysqlConnectionOptions`, … | `MysqlDataSourceOptions`, … |
| `connection.connect()` | `dataSource.initialize()` |
| `connection.close()` | `dataSource.destroy()` |
| `connection.isConnected` | `dataSource.isInitialized` |
| `.connection` on driver / query runner / manager / builder / metadata / events | `.dataSource` |

## The global helpers are gone

`createConnection()`, `createConnections()`, `getConnection()`, `getConnectionManager()`, `getConnectionOptions()`, `getManager()`, `getRepository()`, `getTreeRepository()`, `getMongoRepository()`, `getMongoManager()`, `createQueryBuilder()` — **all removed.**

Hold a `DataSource` instance and pass it. In practice this is the change that touches the most files, and it is a good one: the ambient global was how a repository ended up constructed in a place nobody could inject a test double into.

`TYPEORM_*` environment variables and `ConnectionOptionsEnvReader` are also gone, and **`.env` files are no longer auto-loaded**.

## Repository and find-option removals

| Removed | Replacement |
|---|---|
| `findOneById(id)` | `findOneBy({ id })` |
| `findByIds(ids)` | `findBy({ id: In(ids) })` |
| `Repository.exist()` | `Repository.exists()` |
| `AbstractRepository`, `@EntityRepository`, `getCustomRepository()` | `Repository.extend()` |
| `@RelationCount`, `loadRelationCountAndMap` | `@VirtualColumn` with a sub-query |
| find-options `join` | `relations` |
| **string-array** `select` / `relations` | object syntax (`{ id: true }`, `{ profile: true }`) |

## QueryBuilder removals

| Removed | Replacement |
|---|---|
| `printSql()` | `getSql()` / `getQueryAndParameters()` |
| `onConflict()` | `orIgnore()` / `orUpdate()` |
| object overload of `orUpdate()` | array form |
| `setNativeParameters()` | `setParameters()` |
| `WhereExpression` (type alias) | `WhereExpressionBuilder` |
| lock modes `pessimistic_partial_write`, `pessimistic_write_or_fail` | `pessimistic_write` + `.setOnLocked('skip_locked' \| 'nowait')` |

## The behavioural changes — read these twice

These do not produce compile errors. They change what your queries return.

1. **`invalidWhereValuesBehavior` defaults to `"throw"`.** `null`/`undefined` in a `where` used to be silently ignored — meaning a caller bug produced a query matching *everything*. Now it throws. Use `IsNull()`; restore the old behaviour only as a temporary migration aid (`{ null: "ignore", undefined: "ignore" }`). Scoped to the high-level find APIs; raw `.where()`/`.andWhere()` on a query builder is unaffected.

2. **Non-nullable relations generate `INNER JOIN` instead of `LEFT JOIN`.** For `nullable: false` on a `@ManyToOne` or an owning `@OneToOne`, rows whose relation is missing are now **excluded from results** rather than returned with a null relation. If a query returns fewer rows after the upgrade, start here. Soft-deleted relations still use `LEFT JOIN`.

3. **`orphanedRowAction: "nullify"` against a non-nullable FK now deletes the orphan** instead of throwing a constraint violation. A save that used to fail loudly now removes data.

4. **Postgres enum additions use `ALTER TYPE … ADD VALUE`** instead of the old rename/recreate/drop sequence — a genuine improvement, for *additions only*. Removals and renames still need a hand-written migration ([postgres-specifics.md](postgres-specifics.md)).

## Environment and driver requirements

- **Node.js** `^20.19.0 || ^22.13.0 || >=24.11.0`; compiled to ES2023. Node 16 and 18 are dropped.
- **PostgreSQL driver**: peer dependency `pg@^8.5.1`.
- The entity glob engine moved from `glob` to `tinyglobby` — documented as a drop-in replacement for most projects, which is a good reason to be on explicit entity imports instead ([data-source.md](data-source.md)).
- Other drivers: `mysql` dropped in favour of `mysql2`; `sqlite3` dropped for `better-sqlite3`; MongoDB driver v7+; MSSQL `options.isolation` → `options.isolationLevel`, with `READ_COMMITTED` becoming `READ COMMITTED`.

## The IoC container system is gone

`useContainer()` and `getFromContainer()` are removed, and `typeorm-typedi-extensions` / `typeorm-routing-controllers-extensions` are incompatible. Applications using a framework's own DI — NestJS, for instance — were never using this and are unaffected.

## With NestJS

`@nestjs/typeorm` **≥ 11.0.1** is required for TypeORM 1.x: v10 and v11.0.0 crash at startup because they still register the removed `Connection` class. Current is 12.0.x.

> One loose end worth checking in your own tree: the `@nestjs/typeorm` package's declared `typeorm` peer range has read `^0.3.0 || ^1.0.0-dev` — a prerelease-anchored range does not, under strict npm semver, match a stable `1.1.1`. In practice installations work and TypeORM's own guide names ≥ 11.0.1 as the requirement, but run `npm ls typeorm` and confirm a single resolved version before shipping rather than trusting the range.

## What "not in the 1.x migration" means

`@Transaction`, `@TransactionManager` and `@TransactionRepository` were removed in **0.3.0, back in 2021.** Any article or answer still using them predates 0.3 entirely — a useful dating signal when evaluating a search result.

## A workable order

1. Node and TypeScript to supported versions.
2. Run the codemod on its own commit; review every hunk.
3. Replace the global helpers — this is the bulk of the work.
4. Fix compile errors only. Resist refactoring in the same change.
5. **Then** hunt the silent four: `where` null handling, `INNER JOIN` on non-nullable relations, orphan deletion, and any place a string-array `select`/`relations` was doing something subtle.
6. Run the database-backed lane. Result-shape and join changes are invisible to hermetic tests.
