---
name: versions-and-upgrades
description: NestJS 12 breaking changes, ESM status, Express 5, the TypeScript 7 CLI trap, ecosystem lag
metadata:
  tags: versions, upgrade, migration, esm, express-5, typescript-7, breaking-changes
---

# Versions and upgrades

Everything on this page was verified on **2026-09-06**. Version facts rot; re-check the lockfile and the linked sources before acting on any of it.

## Where things stand

| Package | Current | Notes |
|---|---|---|
| `@nestjs/core`, `@nestjs/common` | **12.0.x** (12.0.0 released **2026-08-27**) | packages ship as ESM |
| `@nestjs/config` | 12.0.0 | Standard Schema validation |
| `@nestjs/typeorm` | 12.0.x | see `engineering-paved-path:typeorm-patterns` for the TypeORM pairing |
| `@nestjs/platform-express` | 12.0.x | pins **Express 5** |
| `@nestjs/cache-manager` | 12.0.0 | caching is **not** in core; install it plus `cache-manager` |
| `@nestjs/throttler` | 6.5.0 (2025-12) | peer range still tops out at `@nestjs/core@^11` |
| `class-validator` | 0.15.1 (2026-02) | maintained, slowly |
| `class-transformer` | 0.5.1 (**2021**) | no tagged release in ~5 years |
| `reflect-metadata` | 0.2.2 | stable |
| Node.js | v20.19+ / v22.12+ | v21, v23, v25 unsupported; CLI generators want v22.22.3+/v24.15+/v26+ |
| TypeScript | 6.x for the build | **7.x currently breaks the Nest CLI** — see below |

## NestJS 12 breaking changes

From the [official migration guide](https://docs.nestjs.com/migration-guide) and the [v12.0.0 release](https://github.com/nestjs/nest/releases/tag/v12.0.0):

- **Core packages ship as ESM.** Migrating your own application is *"entirely optional and not part of upgrading to v12"* — CJS applications keep working through Node's `require(esm)`. `nest new` now asks which layout you want.
- **Node floor raised** (see the table above).
- **Lifecycle hooks are invoked by component hierarchy level.** Execution order can change relative to earlier majors — see [lifecycle.md](lifecycle.md).
- **`@nestjs/config` validation moved to Standard Schema.** Joi still works but needs **Joi 18+**, and its settings move under `validationOptions.libraryOptions`.
- **Pipe signatures refined**; `ArgumentMetadata` is now generic.
- **`ConsoleLogger` structured parameters are on by default** — log output shape changes, which matters if anything parses your logs.
- **NATS transport** switched from `nats` to `@nats-io/transport-node`; packets are JSON strings and deserialisers receive the full message.
- **GraphQL:** `subscriptions-transport-ws` removed (use `graphql-ws`); **GraphiQL is the default IDE** instead of Playground.
- **Webpack CLI workflows deprecated** in favour of Rspack; the `angular` schematic is gone.
- **New:** `HttpExceptionOptions` accepts `errorCode`, serialised into the response body ([exceptions.md](exceptions.md)).
- **New:** the CLI's decorator schematic generates `Reflector.createDecorator()`-style decorators.

## The Express 5 change (arrived in NestJS 11)

Express 5 became the default adapter in **NestJS 11** (2025-01), not 12. Its stricter `path-to-regexp` **rejects bare wildcards**:

```ts
@All('*')      // ❌ Express 5: "Missing parameter name"
@All('*splat') // ✅ named wildcard
```

This is the single most common upgrade break for applications with catch-all routes, static fallbacks or legacy proxy handlers ([expressjs/express#6606](https://github.com/expressjs/express/issues/6606)).

## The TypeScript 7 trap (live issue)

TypeScript 7.0 (2026-07-08) is the native Go rewrite. It **does not expose the programmatic Compiler API**, and `nest build` / `nest start` depend on it — so with `typescript@7` installed, compiler-dependent CLI commands fail for both the `tsc` and the SWC builders. The tracking issue [nest-cli#3479](https://github.com/nestjs/nest-cli/issues/3479) is **open**; what shipped so far is a clearer error telling you to install TypeScript 6.

Until it closes:

- Pin the build toolchain to TypeScript 6.x. NestJS's own `typescript-starter` pins `^6.x`.
- If you want TS 7's speed, run it as a separate `typecheck` script rather than as the compiler the CLI invokes.
- **Re-check the issue before writing this into a project.** It is the fact on this page most likely to have moved.

## Decorators stay legacy

Do not drop `experimentalDecorators` / `emitDecoratorMetadata` in favour of TC39 decorators. Standard decorators have no parameter decorators and no design-time type emission; both are load-bearing for Nest. The generated **ESM** template in v12 still sets both flags. Details and citations in [typescript-setup.md](typescript-setup.md).

## Ecosystem lag is part of the upgrade

A NestJS major moving does not move its satellites. Before committing to an upgrade:

1. `npm ls` (or the equivalent) every `@nestjs/*` package and check its declared peer range against the new core major. `@nestjs/throttler` is the current example of a first-party package trailing the core release.
2. Check third-party Nest modules the same way — an unmaintained one blocks the whole upgrade.
3. Watch for packages whose *last release* predates the change you rely on. `class-transformer` is frozen at a 2021 release; it works, but nothing will be fixed in it. That is a real argument for schema-library validation on new code ([validation.md](validation.md)).

## Upgrade order that avoids thrash

1. Node runtime to a supported line.
2. TypeScript to the version the CLI supports (today: 6.x).
3. `@nestjs/*` core packages together, in one change.
4. Fix the compile errors the migration guide predicts — do not fix anything else in the same commit.
5. Boot the application and compile **every** module in tests without overrides. Wiring breakage is what an upgrade produces, and it is invisible to hermetic tests ([testing.md](testing.md)).
6. Then the satellites, one at a time.
