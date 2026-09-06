# Changelog

All notable changes to `engineering-paved-path` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [2.1.0] - 2026-09-06

### Changed

- **Guidance no longer asks a project to change its dependencies.** A plugin
  is a guest: it works with the stack, versions and tooling the host already
  has. Several passages read as steps rather than observations — "pin the
  build toolchain to TypeScript 6.x", an upgrade order presented as a
  procedure, a nudge toward a different validation library, a strictness flag
  offered as "recommended". All are reframed as findings and options for the
  project's owners to decide on, explicitly not as work to fold into an
  unrelated change. `references/upgrading-from-0.3.md` now opens by saying it
  describes an upgrade rather than asking for one, and that a project staying
  on 0.3.x should read it as a description of its current behaviour.
- **`nestjs-best-practices` is written against Nest's seams, not against a
  package set.** Only `@nestjs/common`, `@nestjs/core`, a platform adapter and
  `reflect-metadata` are always present; `class-validator`,
  `class-transformer`, `@nestjs/config`, `@nestjs/typeorm`, `@nestjs/throttler`
  and `@nestjs/cache-manager` are separate packages a project may not have, and
  the skill no longer assumes any of them. `SKILL.md` opens with a table
  separating the two, `validation.md` presents the pipe seam first with
  `class-validator` and a ten-line schema-library pipe as equal instantiations,
  and the configuration, rate-limiting, persistence and testing rules each say
  what holds without their package. Test examples are runner-agnostic —
  nothing depends on Jest specifically.
- `docs/PLUGIN-GUIDELINES.md` gains **"Respect the host's infrastructure and
  dependencies"** as a stated rule, plus two editorial-checklist items: no
  install command presented as a precondition for guidance, and
  version-dependent claims marked in both directions. The discipline already
  existed in the agents — `implementer` forbids lockfiles and root
  `package.json`, `researcher` forbids installs entirely — but it was an
  accident of their authorship rather than a contract every component owed.

## [2.0.1] - 2026-09-06

### Fixed

- **Version-dependent guidance is now marked as such, in both new skills.**
  They were written against the newest majors (NestJS 12, TypeORM 1.1.1) and
  stated those facts flatly, which reads as universal truth to anyone on an
  older line — and older lines are the common case in practice. Two of the
  claims could produce actively wrong code:
  - **Express route syntax.** Express 5 is the default adapter *since NestJS
    11*; v10 and earlier ship Express 4, where bare `'*'` is correct and
    `'/*splat'` is not understood. `rules/controllers.md` now states both
    directions and says to read the adapter major before touching a
    catch-all route.
  - **TypeORM 0.3.x vs 1.x semantics.** On 0.3.x, `null`/`undefined` in a
    `where` are silently ignored rather than throwing, non-nullable relations
    `LEFT JOIN` rather than `INNER JOIN`, `orphanedRowAction: "nullify"`
    throws rather than deleting, and the global helpers still exist. Each of
    those is now labelled as 1.x-only with the 0.3.x behaviour stated beside
    it, and `SKILL.md` tells a reader on 0.3.x to use the upgrade reference
    as a *difference list* describing what their code does today.
  - `@nestjs/config` Standard Schema validation is marked *since v12*, with
    the version-independent `validate` function offered as the portable
    option.
  - Both `SKILL.md` version tables gained an "Applies to" column, and both
    now open by telling the reader to establish the installed major from the
    lockfile first. What is stable across majors is stated explicitly, so the
    guards do not make the whole skill read as uncertain.

## [2.0.0] - 2026-09-06

### Removed

- **BREAKING — `fastify-best-practices` is gone.** Guidance on the Fastify
  request lifecycle, plugin encapsulation, JSON-Schema validation, hooks,
  serialization and Pino logging is no longer served by this plugin. A project
  that installed the plugin for that content loses it on update.
- **BREAKING — `drizzle-orm-patterns` is gone.** Guidance on Drizzle schema
  builders, query syntax, relations, transactions and Drizzle Kit migrations is
  no longer served by this plugin.

Both were vendored or written for a stack this plugin no longer serves, and a
wrong-stack skill selected by name is worse than no skill. There is no
deprecation window: a skill that answers with the wrong framework cannot be
"soft-removed".

### Added

- **`nestjs-best-practices`** — NestJS application patterns: modules and the
  single composition root, providers and injection tokens, the `import type`
  metadata trap that breaks DI at boot while typechecking clean, thin
  controllers, `class-validator` DTOs and `ValidationPipe` semantics, the
  guard/interceptor/pipe/filter pipeline and its execution order, exception
  filters and error envelopes, `ConfigModule` and fail-closed factories,
  lifecycle and shutdown hooks, `TypeOrmModule` wiring, and testing lanes with
  `Test.createTestingModule`. Includes a dated version baseline (NestJS 12,
  released 2026-08-27) and an upgrade file covering the v12 breaking changes,
  the ESM/CJS position, Express 5 route parsing, and the currently-open
  TypeScript 7 incompatibility with the Nest CLI.
- **`typeorm-patterns`** — TypeORM mechanics for PostgreSQL services:
  `DataSource` configuration and pooling, entities and relations, the
  `save`/`insert`/`upsert`/`update` trade-offs, `QueryBuilder` versus find
  semantics, raw-SQL result shapes, transactions and query-runner obligations,
  soft deletes and which read paths silently do not filter, hand-written
  migration discipline, the constraints expressible at the entity boundary, and
  the PostgreSQL/`node-postgres` behaviour the ORM does not mediate. Baselined
  on TypeORM 1.1.1 (2026-09-01) with a full 0.3 → 1.x upgrade reference.

Both skills record every source URL in their `README.md`, and label the handful
of behaviours that have no upstream documentation to cite, so a reader can
reproduce or disprove them rather than take them on trust.

### Changed

- **`onion-architecture` is now stack-neutral.** Its description and all rule
  prose state layering in framework-neutral terms (HTTP edge / service /
  repository / adapter / platform / shared contract); a vocabulary table maps
  those onto NestJS + TypeORM and onto a framework-less setup; `examples.md` is
  rewritten in NestJS + TypeORM as one clearly-labelled instantiation.
- **`onion-architecture`'s DI position is corrected.** It previously read as a
  blanket prohibition on decorator-based DI, which is backwards for a framework
  where DI *is* the framework. It now says: use the framework's container where
  the framework provides one, compose manually where it does not, and keep the
  pure engine package container-free either way.
- `onion-architecture` absorbed three rules from the runtime skills it used to
  defer to: bind a port through its factory rather than to the concrete adapter
  class, repositories never read configuration, and a hermetic test proves
  logic while only a real module compile proves wiring.
- Plugin description and keywords now name NestJS and TypeORM instead of
  Fastify and Drizzle. The skill count is unchanged at twelve — two skills were
  removed and two added.
- `frontend-architecture` no longer names a specific ORM in its file-placement
  examples.

## [1.0.0] - 2026-07-12

### Added

- Initial release: 12 knowledge skills —
  react-best-practices, react-testing-library, next-best-practices,
  frontend-architecture, fastify-best-practices, onion-architecture,
  drizzle-orm-patterns, postgresql-table-design, zod, typescript-expert,
  security, mermaid-diagram — with their supporting rule files, references,
  and examples.

### Changed

- `onion-architecture` generalized: repository-specific paths and package
  names replaced with generic `src/` / `engine/` / shared-contracts
  equivalents; repository-local convention references removed.
- Cross-skill references rewritten to plugin-namespaced form
  (`engineering-paved-path:<skill>`).
- References to skills not shipped in this marketplace removed from skill
  descriptions.
