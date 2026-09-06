---
name: nestjs-best-practices
description: "NestJS application patterns for TypeScript backends — modules and providers, dependency injection and injection tokens, the composition root, thin controllers, guards/interceptors/pipes/filters and their execution order, validation at the edge, ConfigModule and typed configuration, lifecycle hooks, exception filters, and testing with Test.createTestingModule. Use when building, wiring, reviewing or debugging a NestJS application: adding a module or a provider, resolving 'Nest can't resolve dependencies of X', choosing an injection scope, registering a global guard, shaping an error response, writing a testing module, or upgrading a NestJS major. Trigger terms: NestJS, Nest, @nestjs/common, @nestjs/core, app.module.ts, @Module, @Injectable, @Controller, provider, injection token, forwardRef, ValidationPipe, exception filter, APP_GUARD, Test.createTestingModule, nest build, nest start. NestJS runtime and wiring ONLY — NOT which layer a file belongs to (use engineering-paved-path:onion-architecture), NOT TypeORM query, migration or entity mechanics (use engineering-paved-path:typeorm-patterns), NOT PostgreSQL schema design (use engineering-paved-path:postgresql-table-design), NOT Zod schema mechanics (use engineering-paved-path:zod)."
version: 1.0.0
---

# NestJS — application patterns

How a NestJS application is wired, what breaks it, and why. **Runtime and wiring only** — not layering (`engineering-paved-path:onion-architecture`), not ORM mechanics (`engineering-paved-path:typeorm-patterns`), not schema design (`engineering-paved-path:postgresql-table-design`), not Zod (`engineering-paved-path:zod`).

## Inputs

This skill assumes nothing about your repository beyond what you tell it. When applying it, first locate (or ask for): the application root, the composition root (the module `NestFactory.create()` is given), the feature-module directory, the bootstrap file, and the test commands and their filename conventions. If the project documents its own conventions — an `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, or a repository skill — **those take precedence over anything here.**

### What is Nest, and what is a package you may not have

Only `@nestjs/common`, `@nestjs/core`, a platform adapter and `reflect-metadata` are always present. Everything else below is a **separate package a project either has or does not**, and this skill never assumes it:

| Concern | Always available | Common packages — use whichever the project already has |
|---|---|---|
| Validation at the edge | the pipe seam (`useGlobalPipes`, `@UsePipes`) | `class-validator` + `class-transformer` with `ValidationPipe`; or a schema library behind a small custom pipe |
| Configuration | providers, factories, `process.env` | `@nestjs/config` |
| Persistence | nothing | `@nestjs/typeorm`, `@nestjs/mongoose`, a hand-written provider |
| Rate limiting | the guard seam | `@nestjs/throttler` |
| Caching | nothing | `@nestjs/cache-manager` |
| Tests | nothing | `@nestjs/testing` plus the project's runner (Jest, Vitest, node:test) |

**Write against the seam, not the package.** Where a rule below shows a specific library, it is one instantiation — the surrounding principle holds whatever the project uses, and introducing a package the project does not have is a dependency decision for its owners, never a step in following this skill.

## Version baseline (verified 2026-09-06)

**Establish the project's major before applying anything on this page.** Read
it from the lockfile — `@nestjs/core` — not from this table. Most of what
follows is stable across recent majors, but the rows marked *since* are not,
and applying a v12 fact to a v10 codebase produces confidently wrong advice.
When the project's major is older than the baseline, the relevant deltas are
in [rules/versions-and-upgrades.md](rules/versions-and-upgrades.md), which
reads in both directions.

| Fact | Value | Applies to |
|---|---|---|
| Latest major | **NestJS 12**, released **2026-08-27** ([release notes](https://github.com/nestjs/nest/releases/tag/v12.0.0), [migration guide](https://docs.nestjs.com/migration-guide)) | — |
| Node.js | v20.19+ or v22.12+ to run; v21/v23/v25 unsupported. CLI generators need v22.22.3+/v24.15+/v26+ | **v12**; older majors allow older Node |
| Module format | Core packages **ship as ESM**. Migrating *your* app to ESM is optional — CJS apps keep working through Node's `require(esm)` | **since v12**; v11 and earlier are CJS |
| Decorators | **Legacy TS decorators**: `experimentalDecorators` + `emitDecoratorMetadata`, even in the ESM project template. TC39/Stage-3 decorators are **not** supported | all majors |
| Default HTTP adapter | Express **5** | **since v11**. **v10 and earlier ship Express 4** — the route-syntax rules in [rules/controllers.md](rules/controllers.md) differ |
| TypeScript | `typescript-starter` pins `^6.x`. **TypeScript 7 currently breaks `nest build`/`nest start`** — it dropped the programmatic Compiler API ([nest-cli#3479](https://github.com/nestjs/nest-cli/issues/3479), open) | any major using the Nest CLI |
| Config validation | Standard Schema by default (Zod/Valibot/ArkType); Joi needs **Joi 18+** and moves its settings under `validationOptions.libraryOptions` | **since v12**. Before v12 it is Joi-shaped, flat `validationOptions`, any Joi version |
| `class-transformer` | Last tagged release **0.5.1 (2021)**. Treat it as frozen, not evolving | all majors |

Everything not marked *since* — modules and the composition root, DI and the
`import type` trap, controllers, validation semantics, the enhancer pipeline
and its order, exception filters, lifecycle hooks, testing — holds across v10,
v11 and v12 alike.

See [rules/versions-and-upgrades.md](rules/versions-and-upgrades.md) for the full v12 breaking-change list and the upgrade traps.

## Quick start

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';

// Exported so tests can apply the SAME hardening — see rules/testing.md.
export function configurePlatform(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurePlatform(app);
  await app.listen(process.env.PORT ?? 3000);
}

// Guard the side effect so importing this file from a test does not start a server.
if (require.main === module) void bootstrap();
```

## Reading order

- **New module or provider** → `modules.md` → `dependency-injection.md`
- **"Nest can't resolve dependencies of X"** → `dependency-injection.md` (§ the `import type` trap first — it is the most common cause that compiles clean)
- **New endpoint** → `controllers.md` → `validation.md` → `exceptions.md`
- **Auth / rate limiting / cross-cutting behaviour** → `enhancers.md` → `exceptions.md`
- **Configuration and secrets** → `configuration.md`
- **Writing tests** → `testing.md`
- **Upgrading a major** → `versions-and-upgrades.md`
- **Wiring the database** → `persistence.md`, then `engineering-paved-path:typeorm-patterns`

## Rules

- [rules/typescript-setup.md](rules/typescript-setup.md) — `tsconfig` requirements, `reflect-metadata`, decorator metadata, ESM vs CJS
- [rules/modules.md](rules/modules.md) — module shape, one composition root, dynamic modules, `@Global()`, circular imports
- [rules/dependency-injection.md](rules/dependency-injection.md) — providers, injection tokens, the `import type` trap, injection scopes, optional dependencies
- [rules/controllers.md](rules/controllers.md) — thin controllers, params, status codes, `@Res({ passthrough: true })`, streaming
- [rules/validation.md](rules/validation.md) — `class-validator` DTOs, `ValidationPipe` options, transformation traps
- [rules/enhancers.md](rules/enhancers.md) — guards, interceptors, pipes, filters; execution order; global enhancers and `Reflector`
- [rules/exceptions.md](rules/exceptions.md) — `HttpException` hierarchy, custom errors, exception filters, error envelopes
- [rules/configuration.md](rules/configuration.md) — `ConfigModule`, validation, typed access, fail-closed factories
- [rules/lifecycle.md](rules/lifecycle.md) — lifecycle hooks, shutdown hooks, async initialisation
- [rules/persistence.md](rules/persistence.md) — `TypeOrmModule` wiring, repository injection, the module boundary
- [rules/testing.md](rules/testing.md) — `Test.createTestingModule`, overrides, hermetic vs booted tests, cross-suite leakage
- [rules/versions-and-upgrades.md](rules/versions-and-upgrades.md) — v12 breaking changes, ESM status, Express 5, the TypeScript 7 trap

## Core principles

- **One composition root.** Feature modules wire themselves; exactly one module gathers them. A second gathering module is how a codebase silently grows two graphs — see `modules.md`.
- **DI metadata is emitted, not inferred.** Nest reads constructor types out of `design:paramtypes`, which the compiler writes. Anything that erases that emission (`import type`, an interface as a parameter type, a missing decorator) breaks DI at boot and *only* at boot — see `dependency-injection.md`.
- **The edge validates; nothing downstream re-validates.** DTOs with `class-validator` decorators plus a global `ValidationPipe`. A service must be callable from a unit test with a plain object.
- **Throw typed errors; one filter renders them.** Handlers never build error bodies by hand.
- **Fail closed, loudly.** A misconfigured deploy should refuse to start rather than silently degrade — but know what that costs (`configuration.md`).
- **A green hermetic test proves the code, not the wiring.** Whole classes of Nest failures are invisible until a real module compiles — see `testing.md`.
