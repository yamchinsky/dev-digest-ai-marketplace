# typeorm-patterns skill

A Claude Code skill covering **TypeORM mechanics for PostgreSQL-backed
services** — entities and relations, `DataSource` configuration, the repository
API, `QueryBuilder`, raw SQL, transactions, soft deletes, migrations, and the
constraints TypeORM can express at the entity boundary.

## Version

**1.0.0** — initial release for the `engineering-paved-path` plugin.

## Focus

This skill answers two questions:

1. **How do I express this in TypeORM?** — the right call, the right options,
   the right place.
2. **Why did that come back wrong?** — the behaviours that differ from what the
   API name suggests, including several that are undocumented.

**In scope:**
- `DataSource` options, initialisation, pooling, multiple data sources
- Entities, columns, relations, `cascade`, eager vs lazy, `@RelationId`, transformers
- `save` vs `insert` vs `upsert` vs `update`; find options; repository vs `EntityManager`
- `QueryBuilder`: `take`/`skip` vs `limit`/`offset`, joins, `getMany` vs `getRawMany`, locking
- Raw SQL: parameterisation, result shapes per statement kind, what raw SQL bypasses
- Transactions: the callback form, `QueryRunner` and its release obligation, isolation, manager propagation
- Soft deletes: which read paths filter and which do not; erasure obligations
- Migrations: generate vs create, the review pass, hand-writing rules, transaction modes, reverting
- Indexes and constraints expressible from an entity — and when to drop to SQL
- PostgreSQL and `node-postgres` behaviour the ORM does not mediate
- The full 0.3 → 1.x breaking-change list

**Out of scope:**
- NestJS module wiring, provider injection, `TypeOrmModule` registration (see `engineering-paved-path:nestjs-best-practices`)
- PostgreSQL table design, normalisation, partitioning, JSONB strategy (see `engineering-paved-path:postgresql-table-design`)
- Where a repository file belongs, and what may import it (see `engineering-paved-path:onion-architecture`)
- Zod / DTO validation (see `engineering-paved-path:zod`)

## Relationship to other skills (no overlap)

| Skill | Focus | This skill differs by |
|---|---|---|
| `engineering-paved-path:nestjs-best-practices` | Framework wiring, DI, request pipeline, testing lanes | **No** wiring; only what happens once you hold a `Repository` or a `DataSource` |
| `engineering-paved-path:postgresql-table-design` | Which schema to design: types, normalisation, indexing strategy, partitioning | **Not** design; only what TypeORM can express and where it stops |
| `engineering-paved-path:onion-architecture` | Where the repository lives and who may import it | **No** placement rules |
| `engineering-paved-path:zod` | Schema validation mechanics | Nothing about request validation |

Where a question mixes them — "add a table with a unique index and expose it
through a service" — `postgresql-table-design` answers *what the schema should
be*, this skill answers *how TypeORM expresses it and what the migration must
say*, and `nestjs-best-practices` answers *how it reaches a service*.

## Files

- `SKILL.md` — entry point: version baseline, quick reference, the five sharpest traps. Loaded when the skill triggers.
- `references/*.md` — one topic per file, loaded on demand.
- `README.md` — this file: meta, version, sources, scope boundaries. Not loaded into context.

## Maintenance

- Bump `version` in `SKILL.md` frontmatter and the **Version** section above.
- Add a row to **Version history**.
- Add any new sources below, URL verbatim.
- **Re-verify the version baseline on every edit.** The 1.x line is young and
  moving; `SKILL.md` carries a dated table.
- **Keep the "undocumented" labels honest.** Two claims in this skill —
  `query()` result shapes and the query-builder soft-delete root behaviour —
  have no upstream documentation to cite. If TypeORM documents them, cite the
  page; if a version changes them, change the page.
- If a consuming repository documents its own rules (hand-written migrations
  only, a particular transaction wrapper), that repository wins there.

---

## Sources

Verified **2026-09-06**. URLs verbatim.

### TypeORM — official

- [TypeORM documentation](https://typeorm.io/) — version selector showing 1.x current, 0.3.x legacy.
- [TypeORM 1.0 is here](https://typeorm.io/blog/typeorm-1-0/) — the 1.0 announcement, dated 2026-05-19.
- [Upgrading from 0.3 to 1.0](https://typeorm.io/docs/releases/1.0/upgrading-from-0.3/) — the breaking-change list, the codemod, `Connection` → `DataSource`, the removed globals, the behavioural defaults.
- [Release notes 1.0](https://typeorm.io/docs/releases/1.0/release-notes/) — `invalidWhereValuesBehavior`, `INNER JOIN` for non-nullable relations, `orphanedRowAction`, the enum `ADD VALUE` improvement.
- [raw CHANGELOG.md](https://raw.githubusercontent.com/typeorm/typeorm/master/CHANGELOG.md) and [raw package.json](https://raw.githubusercontent.com/typeorm/typeorm/master/package.json) — exact versions, dates, `engines`, the `pg@^8.5.1` peer dependency.
- [Data source options](https://typeorm.io/docs/data-source/data-source-options/) — the option surface, `entities` shape.
- [DataSource API](https://typeorm.io/docs/data-source/data-source-api/) — `query()` parameterisation and the per-driver placeholder syntax.
- [How migrations work](https://typeorm.io/docs/migrations/why/) — the `synchronize: true` warning.
- [Executing and reverting migrations](https://typeorm.io/docs/migrations/executing/) — `--transaction all|each|none`, `migrationsRun`.
- [Repository API](https://typeorm.io/docs/working-with-entity-manager/repository-api/) — `save` semantics, `softDelete`/`softRemove`/`restore`/`recover`, `upsert` and `skipUpdateIfNoValuesChanged`.
- [Select QueryBuilder](https://typeorm.io/docs/query-builder/select-query-builder/) — the verbatim `take`/`skip` vs `limit`/`offset` statement.
- [Eager and lazy relations](https://typeorm.io/docs/relations/eager-and-lazy-relations/) — the verbatim statement that `QueryBuilder` disables eager relations.
- [Relations](https://typeorm.io/docs/relations/relations/) — `cascade` traversing only populated relations, `onDelete`, `@RelationId` being derived.
- [Transactions](https://typeorm.io/docs/transactions/) — the "DO NOT USE GLOBAL ENTITY MANAGER" warning, the query-runner release obligation, the isolation-level caveat.
- [Indexes](https://typeorm.io/docs/indexes/) — `@Index`/`@Unique`, and the verbatim statement that unsupported index definitions must be created manually in migrations.
- [typeorm#11906](https://github.com/typeorm/typeorm/issues/11906) — open: `withDeleted()` behaves differently depending on call order relative to `leftJoinAndSelect()`.
- [typeorm#1828](https://github.com/typeorm/typeorm/issues/1828) — the `@Transaction*` decorators were removed in 0.3.0, not in 1.x.
- [typeorm PR #10956](https://github.com/typeorm/typeorm/pull/10956) — direct `ALTER TYPE … ADD VALUE` for enum additions.

### PostgreSQL and node-postgres

- [PostgreSQL — CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) — verbatim: `CREATE INDEX CONCURRENTLY` cannot run in a transaction block.
- [PostgreSQL — ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html) — `ADD VALUE` / `RENAME VALUE`, no `DROP VALUE`, and the "cannot be used until the transaction commits" caveat.
- [node-postgres — Pool](https://node-postgres.com/apis/pool) — pool defaults (`max: 10`, `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 0`).
- [node-postgres — Types](https://node-postgres.com/features/types) — `timestamp`/`DATE` parsed in the process's local timezone; the recommendation to use `TIMESTAMPTZ`.
- [brianc/node-postgres#1300](https://github.com/brianc/node-postgres/issues/1300) — why `int8`/`numeric` are returned as strings.

### With NestJS

- [nestjs/typeorm — raw package.json](https://raw.githubusercontent.com/nestjs/typeorm/master/package.json) — current version and peer ranges.
- [nestjs/typeorm v11.0.1](https://github.com/nestjs/typeorm/releases/tag/11.0.1) — the release that stopped registering the removed `Connection` class.

### Behaviours with no upstream documentation

Several behaviours in `references/raw-sql.md`, `references/soft-deletes.md`,
`references/migrations.md` and `references/postgres-specifics.md` are **not
stated by any documentation**. They are observable on TypeORM 1.x with the `pg`
driver, and each is written so a reader can confirm it with a database-backed
test rather than take it on trust:

- `dataSource.query()` returning `[rows, affectedCount]` for `UPDATE`/`DELETE … RETURNING` but a plain rows array for `INSERT … RETURNING`, including `ON CONFLICT` — and `EntityManager.query()` delegating verbatim.
- `createQueryBuilder` not applying the soft-delete predicate to the **root** entity while applying it to joined relations.
- `migration:generate` emitting one `CREATE`/`DROP TYPE` per column for an enum shared by two entities, and proposing to drop hand-written constraints on every run.
- `node-postgres` yielding a local-timezone `Date` for `DATE` columns on raw queries where the repository path applies transforms.
- `array_length(col, 1)` returning `NULL` for `'{}'`, so a `CHECK` built on it admits the empty array.
- Postgres requiring an explicit `::enum` cast on every `CASE` branch assigning to an enum column.
- `EntityManager` caching one repository instance per entity target, which makes `jest.spyOn(dataSource.getRepository(X), 'find')` a reliable query-count probe.

They are recorded here because they are real and undocumented, not because a
particular repository has them.

### Conflicting opinions / open questions

- **Generated vs hand-written migrations.** TypeORM recommends `migration:generate`; schemas with hand-written SQL past a certain density get more noise than value from it. The skill describes the threshold rather than prescribing one policy.
- **`query()` return shapes.** Documented nowhere; community reports also describe raw `UPDATE`/`DELETE` *without* `RETURNING` coming back as an empty array on PostgreSQL. The skill tells the reader to pin the shape with a test.
- **Overriding `pg` type parsers globally.** Removes the string/number friction for `bigint`/`numeric` at the cost of silent precision loss. The skill recommends local conversion; reasonable people set the parser.
- **`@nestjs/typeorm`'s prerelease-anchored `typeorm` peer range.** Flagged as something to verify with `npm ls` rather than resolved.

---

## Version history

- **1.0.0 (2026-09-06)** — initial release. Written against TypeORM 1.1.1
  (2026-09-01), `pg` 8.x, Node 20.19+/22.13+/24.11+, and `@nestjs/typeorm`
  12.0.x. Replaces the Drizzle-oriented ORM skill that previously occupied this
  slot in the plugin.
