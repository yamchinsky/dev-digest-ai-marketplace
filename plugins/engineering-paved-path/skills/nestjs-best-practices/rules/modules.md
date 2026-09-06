---
name: modules
description: Module shape, the single composition root, dynamic modules, global modules, module-level circular imports
metadata:
  tags: modules, composition-root, dynamic-modules, global, exports, imports
---

# Modules

A module is the unit of wiring, not a folder convention. `@Module()` declares four things and nothing else:

```ts
@Module({
  imports: [OtherModule],       // what this module may resolve from
  controllers: [FooController], // HTTP edge
  providers: [FooService, FooRepository, { provide: FOO_PORT, useFactory: … }],
  exports: [FooService],        // what OTHER modules may resolve from this one
})
export class FooModule {}
```

`exports` is the module's public surface. A provider that is not exported is module-private no matter how many other modules import the module — that is the feature, not a limitation.

## Feature module shape

A feature module is a self-contained folder:

```
modules/<name>/
  <name>.module.ts       # wiring for THIS module only
  <name>.controller.ts   # thin HTTP edge
  <name>.service.ts      # business logic
  <name>.repository.ts   # all ORM / raw-SQL access
  dto/                   # request + response DTOs
```

Add only when needed, never speculatively:

- `<name>.errors.ts` — module-specific error classes
- `<name>.mappers.ts` — entity ↔ DTO / contract mapping
- `<name>.tokens.ts` — DI tokens for the module's ports
- `ports/` + `adapters/` + a `*.factory.ts` — when the module talks to an external system through a swappable interface

Where each of those files sits in the dependency rings is `engineering-paved-path:onion-architecture`'s question, not this file's.

## One composition root (CRITICAL)

Exactly one module imports the feature modules — the one handed to `NestFactory.create()`. Every feature module must stay independently bootable:

```ts
const moduleRef = await Test.createTestingModule({ imports: [FooModule] }).compile();
```

If that fails while the app boots fine, `FooModule` is not self-contained — it is relying on something a sibling module happens to provide.

**A feature module may import one other feature module it genuinely depends on.** What the rule forbids is a *second composition root*: a feature module that gathers three or more others. That is the shape that turns a reviewable one-file wiring list into a graph nobody can hold in their head, and it is usually a sign that a shared concept wants extracting into its own module.

When two features need the same infrastructure port, you have three options and only two are acceptable:

1. **Extract a module** that owns the port, its adapters and its factory; both features import it. Right when the capability is not really *about* either feature.
2. **The owning module exports the token**, the other imports the module. Cheap, and fine while the count of such edges stays small — but it widens one feature's public surface for a dependency that is not about that feature.
3. ~~Duplicate the adapter in the second module.~~ Two copies of credential handling and key naming. Reject on sight.

Which module owns shared infrastructure is a structural decision. The way it quietly goes wrong is a one-line `exports:` edit nobody reviewed as a decision.

## Dynamic modules

A module that needs configuration exposes a static method returning a `DynamicModule`. The returned metadata *extends* the base module's metadata rather than replacing it.

```ts
@Module({})
export class StorageModule {
  static forRoot(options: StorageOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [{ provide: STORAGE_OPTIONS, useValue: options }, StorageService],
      exports: [StorageService],
    };
  }

  static forRootAsync(options: StorageAsyncOptions): DynamicModule {
    return {
      module: StorageModule,
      imports: options.imports ?? [],
      providers: [
        { provide: STORAGE_OPTIONS, useFactory: options.useFactory, inject: options.inject ?? [] },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
```

Conventions worth following because the ecosystem follows them:

- `forRoot` / `forRootAsync` — configured once, for the whole app.
- `register` / `registerAsync` — configured per importing module (multiple instances with different options).
- `forFeature` — a narrow slice of an already-`forRoot`-ed module (`TypeOrmModule.forFeature([Entity])` is the canonical example).

Use `forRootAsync` whenever the options come from `ConfigService`. `forRoot` with values read from `process.env` inline works, but it evaluates at module-definition time, before any validation has run.

## `@Global()` — the documented position

The docs are direct about it: *"making everything global is not recommended as a design practice. While global modules can help reduce boilerplate, it's generally better to use the `imports` array to make a module's API available to other modules in a controlled and clear way."* ([modules](https://docs.nestjs.com/modules))

Legitimate uses are narrow: a config module, a logger, a database connection — infrastructure that genuinely belongs to every module. Everything else pays a real cost: with a global module you can no longer read a module's dependencies off its `imports` array, and a test that boots one feature module silently gets providers it never declared.

## Circular module imports

`forwardRef()` on both sides makes the cycle resolvable, but see [dependency-injection.md](dependency-injection.md) — instantiation order becomes indeterminate, and the cycle is nearly always a design signal. Between two *feature* modules it is a strong one: extract the shared concept, or invert one side onto a port.

## Registration checklist for a new module

- [ ] The module is added to the composition root — and to nowhere else.
- [ ] `Test.createTestingModule({ imports: [TheModule] }).compile()` succeeds with no extra imports.
- [ ] Only what other modules genuinely need is in `exports`.
- [ ] Providers bound to a port go through the port's factory, not `useClass` on the adapter (see [dependency-injection.md](dependency-injection.md)).
- [ ] No new `@Global()` unless it is infrastructure every module uses.
- [ ] If it added a table with a user-owned foreign key, the data-erasure path knows about it — see [persistence.md](persistence.md).
