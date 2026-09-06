---
name: typeorm-patterns
description: "TypeORM patterns for PostgreSQL-backed TypeScript services — entity and relation definition, DataSource configuration, repository vs EntityManager, QueryBuilder versus find semantics, raw-SQL escape hatches and their result shapes, hand-written migration discipline, transactions and query runners, soft deletes, and the indexes and constraints TypeORM can express at the entity boundary. Use when defining or changing an entity, writing or reviewing a query, generating or hand-writing a migration, wrapping work in a transaction, debugging a result that came back in an unexpected shape, adding a soft-deletable table, or upgrading TypeORM. Trigger terms: TypeORM, DataSource, Repository, EntityManager, createQueryBuilder, getRepository, @Entity, @Column, @ManyToOne, @DeleteDateColumn, migration:generate, migration:run, softDelete, withDeleted, QueryRunner, upsert, node-postgres, pg. TypeORM mechanics ONLY — NOT NestJS module wiring or provider injection (use engineering-paved-path:nestjs-best-practices), NOT PostgreSQL table and index design (use engineering-paved-path:postgresql-table-design), NOT where a repository file belongs in the layering (use engineering-paved-path:onion-architecture)."
version: 1.0.0
---

# TypeORM — patterns for PostgreSQL services

What TypeORM actually does, where it differs from what its API suggests, and which behaviours are undocumented and must be pinned by a test. **ORM mechanics only** — not Nest wiring (`engineering-paved-path:nestjs-best-practices`), not schema design (`engineering-paved-path:postgresql-table-design`), not layering (`engineering-paved-path:onion-architecture`).

## Inputs

This skill assumes nothing about your repository beyond what you tell it. When applying it, first locate (or ask for): the `DataSource` definition, the entity directory, the migrations directory and its naming convention, the migration commands, the database-backed test command and how it gets a database. If the project documents its own rules — hand-written migrations only, a particular transaction wrapper, a repository convention — **those take precedence over anything here.**

## Version baseline (verified 2026-09-06)

**Read the installed version out of the lockfile before applying anything on this page.** TypeORM 1.x is the current line and is recent, so "TypeORM is 0.3.x" as a working assumption is out of date — but **0.3.x is still maintained and still widely deployed**, and the two lines differ in ways that change query results rather than raising errors. Treat every 1.x-specific claim below as inapplicable until you have confirmed the major.

If the project is on **0.3.x**, read [references/upgrading-from-0.3.md](references/upgrading-from-0.3.md) as a *difference list*, not an upgrade plan: everything it says changed in 1.0 is a statement about what your code does **today**. In particular, on 0.3.x `null`/`undefined` in a `where` are silently ignored rather than throwing, non-nullable relations `LEFT JOIN` rather than `INNER JOIN`, the global helpers (`getRepository`, `getManager`, `createConnection`) still exist, and string-array `select`/`relations` still work.

| Fact | Value |
|---|---|
| Current | **1.1.1**, released **2026-09-01**. 1.1.0 → 2026-07-13; **1.0.0 → 2026-05-19** |
| 0.3.x | still patched (`0.3.31`), marked **legacy** on the docs version selector |
| Node.js | `^20.19.0 \|\| ^22.13.0 \|\| >=24.11.0`; compiled to ES2023 — Node 16/18 dropped |
| PostgreSQL driver | peer dependency `pg@^8.5.1` — the **pg 8.x** line |
| With NestJS | `@nestjs/typeorm` **≥ 11.0.1** is required for TypeORM 1.x; v10 and v11.0.0 crash at startup because they still register the removed `Connection` class. Current is 12.0.x |
| Upgrade aid | `npx @typeorm/codemod v1 src/` |

1.0 was the first breaking release in about five years. [references/upgrading-from-0.3.md](references/upgrading-from-0.3.md) has the full list; the four changes most likely to alter behaviour silently — **all four are 1.x-only, and on 0.3.x the pre-change behaviour in each is what you have**:

- **`invalidWhereValuesBehavior` defaults to `"throw"` in 1.x.** `null`/`undefined` in a `where` were silently ignored on 0.3.x; on 1.x they throw. Use `IsNull()`, or opt back in explicitly.
- **Non-nullable relations generate `INNER JOIN` in 1.x, `LEFT JOIN` on 0.3.x.** Rows are silently *excluded* on 1.x where 0.3.x returned them with a null relation.
- **`orphanedRowAction: "nullify"` against a non-nullable FK deletes the orphan in 1.x**; on 0.3.x it throws a constraint violation.
- **The global helpers are gone in 1.x** — `getRepository()`, `getManager()`, `createConnection()`, `getConnection()` and the rest. On 0.3.x they still exist; hold a `DataSource` and pass it anyway, because that is the shape that survives the upgrade.

## Quick reference

Valid on both lines unless a row says otherwise.

| Operation | Call | Note |
|---|---|---|
| Read one | `repo.findOneBy({ id })` | excludes soft-deleted roots |
| Read many | `repo.find({ where, relations, take, skip })` | object syntax for `relations`/`select` — **required** on 1.x, accepted on 0.3.x, so write it this way on both |
| Insert | `repo.insert(values)` | no SELECT, no cascades, no lifecycle hooks |
| Insert-or-update | `repo.upsert(values, { conflictPaths })` | needs a unique constraint on the conflict target |
| Persist an entity | `repo.save(entity)` | **SELECTs first**, cascades, runs subscribers |
| Update by condition | `repo.update(where, patch)` | no entity load, **no subscribers** |
| Soft delete by condition | `repo.softDelete(where)` | sets `@DeleteDateColumn` |
| Soft delete an entity | `repo.softRemove(entity)` | cascades like `remove()` |
| Complex query | `repo.createQueryBuilder('x')` | **ignores eager relations and soft-delete on the root** |
| Raw SQL | `dataSource.query(sql, params)` | `$1` placeholders; result shape varies by statement — see below |
| Transaction | `dataSource.transaction(async (m) => …)` | use `m`, never the global manager |

## The five things that bite hardest

1. **`dataSource.query()`'s result shape depends on the statement kind** and is not documented. Getting it wrong fails silently or throws inside someone else's transaction → [references/raw-sql.md](references/raw-sql.md).
2. **`createQueryBuilder` does not apply the soft-delete filter to the root entity** — only `find*` does → [references/soft-deletes.md](references/soft-deletes.md).
3. **`take`/`skip` and `limit`/`offset` are not synonyms** once a join is involved → [references/query-builder.md](references/query-builder.md).
4. **Generated migrations need a review pass**, and some things can never be generated → [references/migrations.md](references/migrations.md).
5. **Soft-deleting the owner means `ON DELETE CASCADE` never fires.** Cascades on a soft-deleted parent are decorative → [references/soft-deletes.md](references/soft-deletes.md).

## References

### Core
- **[references/data-source.md](references/data-source.md)** — `DataSource` options, initialisation, pooling, multiple data sources
- **[references/entities-and-relations.md](references/entities-and-relations.md)** — entities, columns, relations, cascade, eager vs lazy, `@RelationId`
- **[references/repository-api.md](references/repository-api.md)** — `save` vs `insert` vs `upsert` vs `update`, find options, repository vs `EntityManager`
- **[references/query-builder.md](references/query-builder.md)** — `take`/`skip`, joins, `getMany` vs `getRawMany`, subqueries, locking

### The sharp edges
- **[references/raw-sql.md](references/raw-sql.md)** — `query()` result shapes, parameterisation, what raw SQL bypasses
- **[references/transactions.md](references/transactions.md)** — `transaction()`, `QueryRunner`, isolation, propagating the manager
- **[references/soft-deletes.md](references/soft-deletes.md)** — `@DeleteDateColumn`, which paths filter and which do not, erasure
- **[references/migrations.md](references/migrations.md)** — generate vs create, the review pass, hand-writing rules, running them
- **[references/indexes-and-constraints.md](references/indexes-and-constraints.md)** — what `@Index`/`@Unique` can express, and when to drop to SQL
- **[references/postgres-specifics.md](references/postgres-specifics.md)** — `pg` type parsing, enums, `CONCURRENTLY`, pooling traps

### Upgrading
- **[references/upgrading-from-0.3.md](references/upgrading-from-0.3.md)** — the full 0.3 → 1.x breaking-change list

## Working rules

- **`synchronize: false`.** TypeORM's own words: *"it is unsafe to use `synchronize: true` for schema synchronization on production once you get data in your database."*
- **The repository owns the ORM.** Nothing above it imports `typeorm` — see `engineering-paved-path:onion-architecture`.
- **A mocked query result proves nothing about a real one.** Anything that depends on a driver's actual return shape needs a database-backed test.
- **Prefer one atomic statement over read-then-write.** A conditional `UPDATE … WHERE … RETURNING` makes the database the arbiter; a read followed by a write is a race with extra steps.
- **Every new table with an owner FK needs an erasure story** — decided when the table is added, not when someone asks about deletion.
