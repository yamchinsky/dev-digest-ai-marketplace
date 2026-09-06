# nestjs-best-practices skill

A Claude Code skill covering **NestJS application patterns** — modules and
providers, dependency injection, the request pipeline, validation at the edge,
configuration, lifecycle and testing.

## Version

**1.0.0** — initial release for the `engineering-paved-path` plugin.

## Focus

This skill answers two questions for a NestJS codebase:

1. **How is this wired?** — modules, providers, injection tokens, enhancers,
   the composition root.
2. **Why did that break?** — the failures that compile clean and surface only
   at boot, in an end-to-end run, or in production.

**In scope:**
- TypeScript configuration NestJS depends on (decorator metadata, `reflect-metadata`, ESM vs CJS)
- Module shape, the single composition root, dynamic modules, `@Global()`
- Providers, injection tokens, injection scopes, the `import type` DI trap, `forwardRef`
- Thin controllers, parameter decorators, `@Res({ passthrough: true })`, streaming
- `class-validator` DTOs and `ValidationPipe` semantics
- Guards / interceptors / pipes / filters, their execution order, global registration, `Reflector`
- Exception hierarchy, domain errors, exception filters, error envelopes
- `ConfigModule`, schema validation, typed access, fail-closed factories
- Lifecycle hooks, shutdown hooks, background work outside the request lifecycle
- `TypeOrmModule` wiring and the repository boundary (Nest side only)
- `Test.createTestingModule`, overrides, lane split, cross-suite leakage
- NestJS 12 breaking changes and the current upgrade traps

**Out of scope:**
- Which layer a file belongs to (see `engineering-paved-path:onion-architecture`)
- TypeORM entity, query, migration, transaction and soft-delete mechanics (see `engineering-paved-path:typeorm-patterns`)
- PostgreSQL schema design (see `engineering-paved-path:postgresql-table-design`)
- Zod schema mechanics (see `engineering-paved-path:zod`)
- Type-level programming (see `engineering-paved-path:typescript-expert`)
- Security review (see `engineering-paved-path:security`)

## Relationship to other skills (no overlap)

| Skill | Focus | This skill differs by |
|---|---|---|
| `engineering-paved-path:onion-architecture` | Where a file lives; which way dependencies point | **No** placement rules; only how the framework wires what you placed |
| `engineering-paved-path:typeorm-patterns` | Entities, queries, migrations, transactions, soft deletes | **No** query mechanics; only module registration and the injection boundary |
| `engineering-paved-path:postgresql-table-design` | Postgres schema, types, indexing, partitioning | Not schema design |
| `engineering-paved-path:zod` | Zod schema mechanics | Only *where* validation happens and which pipe options mean what |
| `engineering-paved-path:typescript-expert` | Type-level programming, tooling, monorepos | Only the compiler options Nest's runtime depends on |
| `engineering-paved-path:security` | OWASP review guidance | Only the fail-closed wiring shape, not the vulnerability catalogue |

## Files

- `SKILL.md` — entry point: version baseline, reading order, core principles. Loaded when the skill triggers.
- `rules/*.md` — one topic per file, loaded on demand.
- `README.md` — this file: meta, version, sources, scope boundaries. Not loaded into context.

## Maintenance

- Bump `version` in `SKILL.md` frontmatter and the **Version** section above.
- Add a row to **Version history**.
- Add any new sources below, URL verbatim.
- **Re-verify the version baseline on every edit.** `SKILL.md` and
  `rules/versions-and-upgrades.md` both carry a dated table; a stale table is
  worse than no table. The TypeScript 7 / `nest-cli` issue in particular is
  expected to change.
- If a consuming repository documents conventions that diverge from this
  skill, that repository's own documents win there — this skill is the
  default, not an override.

---

## Sources

All sources used to derive these rules, verified **2026-09-06**. URLs verbatim.

### NestJS — official

- [NestJS documentation](https://docs.nestjs.com/) — the whole site is the base reference.
- [Migration guide (v11 → v12)](https://docs.nestjs.com/migration-guide) — canonical breaking-change list, ESM status, the generated ESM `tsconfig`, `@nestjs/config` Standard Schema move, `HttpExceptionOptions.errorCode`. Raw source: [content/migration.md](https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/migration.md).
- [Release v12.0.0](https://github.com/nestjs/nest/releases/tag/v12.0.0) — released 2026-08-27; `Reflector.createDecorator()` schematic, CLI changes.
- [Modules](https://docs.nestjs.com/modules) — `@Global()` guidance, dynamic modules, metadata extension.
- [Custom providers](https://docs.nestjs.com/fundamentals/custom-providers) — `useValue` / `useClass` / `useFactory` / `useExisting`, when `@Inject()` is required.
- [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes) — scope semantics and the ~5% latency statement.
- [Circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency) — `forwardRef` on both sides; the indeterminate-instantiation-order warning; `ModuleRef` as the alternative.
- [Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle) — the enhancer ordering, and interceptors resolving first-in-last-out.
- [Exception filters](https://docs.nestjs.com/exception-filters) — the hierarchy, `@Catch()`, and the middleware-bypasses-scoped-filters limitation.
- [Validation](https://docs.nestjs.com/techniques/validation) — `ValidationPipe` option semantics; the generics/interfaces caveat.
- [Configuration](https://docs.nestjs.com/techniques/configuration) — `isGlobal`, typed `ConfigService`, module-initialisation-order caveat.
- [Lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events) — hook list, `enableShutdownHooks()`, request-scoped classes get no hooks.
- [Testing](https://docs.nestjs.com/fundamentals/testing) — `Test.createTestingModule`, the override methods, `await app.close()`.
- [Caching](https://docs.nestjs.com/techniques/caching) — caching lives in `@nestjs/cache-manager`.
- [nestjs/typescript-starter](https://github.com/nestjs/typescript-starter/blob/master/package.json) — the TypeScript version the project itself ships against.

### Decorators and compiler metadata

- [nestjs/nest#11414](https://github.com/nestjs/nest/issues/11414) — maintainer position on TC39/Stage-3 decorators: blocked on metadata support and parameter decorators.
- [microsoft/TypeScript#57533](https://github.com/microsoft/TypeScript/issues/57533) — design-time type emission lost outside legacy decorators.
- [typescript-eslint — changes to consistent-type-imports with decorators](https://typescript-eslint.io/blog/changes-to-consistent-type-imports-with-decorators/) — the canonical write-up of `import type` erasing `design:paramtypes`, and why the lint rule skips decorated files.
- [TypeScript — `verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) — the erasure mechanism underneath that trap.

### Platform and tooling

- [nestjs/nest-cli#3479](https://github.com/nestjs/nest-cli/issues/3479) — open: TypeScript 7 removed the programmatic Compiler API, breaking `nest build` / `nest start`.
- [expressjs/express#6606](https://github.com/expressjs/express/issues/6606) — Express 5 wildcard route parsing.
- npm registry metadata for `@nestjs/core`, `@nestjs/common`, `@nestjs/config`, `@nestjs/typeorm`, `@nestjs/testing`, `@nestjs/swagger`, `@nestjs/platform-express`, `@nestjs/cache-manager`, `@nestjs/throttler`, `typescript`, `reflect-metadata` — versions, release dates, `engines` and peer ranges.
- [typestack/class-validator releases](https://github.com/typestack/class-validator/releases) and [typestack/class-transformer releases](https://github.com/typestack/class-transformer/releases) — release cadence.

### Field evidence

Several traps in `rules/dependency-injection.md`, `rules/testing.md`,
`rules/configuration.md` and `rules/controllers.md` are generalised from
production incidents in a NestJS + TypeORM + PostgreSQL codebase — the
`import type` DI failure and its lint-autofix vector, the disable-comment
displacement, the bootstrap/testing-harness hardening gap, the per-boot
rate-limit budget, the cross-suite environment leak, the passthrough-response
status conflict, and the fail-closed-factory deploy coupling. They are
recorded here because they are **not** documented by NestJS, not because a
particular repository has them.

### Conflicting opinions / open questions

- **`class-validator` vs a Standard Schema library.** Nest's docs build on `class-validator`, but `class-transformer` has not shipped a release since 2021 while `@nestjs/config` moved to Standard Schema in v12. This skill states the trade rather than picking for the reader.
- **Domain errors vs throwing `HttpException` from services.** Both are defensible; the skill's position is only that a codebase must pick one.
- **`enableImplicitConversion`.** Not covered by Nest's own validation page; the skill recommends explicit `@Type` over enabling it globally, which is a judgement, not a documented position.

---

## Version history

- **1.0.0 (2026-09-06)** — initial release. Written against NestJS 12.0.x
  (released 2026-08-27), Node 20.19+/22.12+, legacy TS decorators, Express 5,
  and the open TypeScript 7 / `nest-cli` incompatibility. Replaces the
  Fastify-oriented runtime skill that previously occupied this slot in the
  plugin.
