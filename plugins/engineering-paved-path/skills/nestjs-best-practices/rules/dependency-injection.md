---
name: dependency-injection
description: Providers, injection tokens, the import-type metadata trap, injection scopes, optional dependencies
metadata:
  tags: di, providers, inject, tokens, scopes, design-paramtypes, forwardref
---

# Dependency injection

In NestJS, DI **is** the framework. There is no separate composition-root file assembling objects by hand — `@Module({ providers })` is the composition root, and the container resolves the graph at boot.

That has one consequence worth internalising before anything else: **the wiring is only checked when a real module compiles.** Everything in this file that can go wrong goes wrong at boot, not at compile time, and not in a test that constructs the class directly.

## Provider forms

| Form | Use when | Token |
|---|---|---|
| `ClassProvider` (`ServiceClass` shorthand, or `{ provide, useClass }`) | The common case: a concrete class the container instantiates | The class itself |
| `{ provide: TOKEN, useValue }` | A constant, an already-built object, an external library instance, or a mock in tests | Your token |
| `{ provide: TOKEN, useFactory, inject: [...] }` | The instance depends on config or must be chosen at runtime | Your token |
| `{ provide: NEW, useExisting: OLD }` | An alias for an existing provider — **not** a second instance | Your token |

`useExisting` is the one that gets misread. It does not create anything; both tokens resolve to the same instance. Reaching for `useClass` where you meant `useExisting` gives you two live objects, two caches, two schedulers.

## Injection tokens

`@Inject()` is required whenever the token is **not** a class: a string, a `Symbol`, or an interface-shaped port.

```ts
// tokens.ts — one file per module, exported
export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

// port
export interface MediaStorage {
  put(key: string, bytes: Buffer): Promise<void>;
}

// consumer
@Injectable()
export class GalleryService {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}
}
```

Interfaces do not exist at runtime, so the emitted `design:paramtypes` entry for `storage` is `Object` and the container has nothing to look up — the explicit token is what makes it resolvable. Prefer `Symbol` or a `const` string in a dedicated `*.tokens.ts` over inline string literals: a typo in one of two duplicated string literals fails at boot with a message that names the token, not the typo.

### Bind a port through the factory that owns its safety checks

```ts
// ❌ a second module binds the same port straight to the class
{ provide: PUSH_PORT, useClass: ExpoPushAdapter }

// ✅ reuse the factory the owning module uses
{ provide: PUSH_PORT, useFactory: createExpoPushAdapter, inject: [ConfigService] }
```

When a factory exists for an adapter, it exists for a reason — a credential check, an environment gate, a boot-time validation. Binding the raw class in a second module silently drops whatever the factory was protecting, for every call that goes through that module. If two modules need the same port, either both go through the factory or one module exports the token and the other imports it.

---

## The `import type` trap (the one that compiles clean and fails at boot)

**Symptom:** `Nest can't resolve dependencies of the FooService (?, BarRepository). Please make sure that the argument dependency at index [0] is available…` — while the class it names is plainly imported and plainly provided.

**Cause:** the class arrived through `import type`. With legacy decorators, `emitDecoratorMetadata` writes the *value* referenced by each parameter's type into `design:paramtypes`. A `type`-modified import is erased from the emitted JavaScript, so there is no value left to write; TypeScript emits the placeholder `Function` instead of the class reference. The container looks up a provider registered under `Function`, finds none, and gives up.

```ts
// ❌ compiles, typechecks, breaks at boot
import type { OrderRepository } from './order.repository';

@Injectable()
export class OrderService {
  constructor(private readonly repo: OrderRepository) {}
}

// ✅ value import — the class reference survives into the metadata
import { OrderRepository } from './order.repository';
```

Three properties make this the most expensive small mistake in a Nest codebase:

1. **It typechecks.** `tsc --noEmit` is green. The types are correct; only the emit is wrong.
2. **Hermetic tests do not see it.** A spec that does `new OrderService(mockRepo)` never asks the container to resolve anything, so it passes at 100%. Only a test that compiles a real module (`Test.createTestingModule` with no override for that provider) or a real boot reaches the failure.
3. **A lint rule actively proposes it.** `@typescript-eslint/consistent-type-imports` cannot distinguish "used only as a type" from "used only as a type *but still needed as a value for DI metadata*", and its **autofix offers to convert exactly this import**. Accepting it produces code that looks tidier and boots to a 500.

### The convention that survives contact with the linter

Keep the value import and mark why:

```ts
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OrderRepository } from './order.repository';
```

Two follow-on rules, both learned the hard way:

- **Token-resolved parameters are exempt.** `@Inject(TOKEN)`, `@InjectRepository(Entity)`, `@InjectDataSource()` tell the container what to inject explicitly, so the emitted metadata is not consulted. Those imports may stay `import type`.
- **A disable comment protects exactly one line — the next one.** Inserting a new import between the comment and the import it guards silently moves the protection onto the newcomer and re-arms the autofix underneath. Nothing fails: typecheck stays green, hermetic specs stay green, and the lint warning hides among the other identical ones. After touching an import block, re-check that every disable comment still sits directly above the import it names.

The typescript-eslint team's own mitigation is to make the rule skip files that contain decorators when both decorator flags are on ([their write-up](https://typescript-eslint.io/blog/changes-to-consistent-type-imports-with-decorators/)) — worth checking whether your version does that before adding disable comments everywhere.

> This trap is not documented on `docs.nestjs.com`. The mechanism is documented on the TypeScript side (`verbatimModuleSyntax` erases `type`-modified imports) and by typescript-eslint; the DI consequence is not stated by Nest itself. Do not go looking for a Nest doc page confirming it.

---

## Injection scopes

| Scope | Behaviour |
|---|---|
| `Scope.DEFAULT` | One instance shared by the whole application |
| `Scope.REQUEST` | A new instance per incoming request, garbage-collected after it |
| `Scope.TRANSIENT` | A new dedicated instance per consumer |

The documented guidance is *"using singleton scope is recommended for most use cases"*, with the measured caveat that *"a properly designed application that leverages request-scoped providers should not slow down by more than ~5% latency-wise"* ([injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes)).

Two things the table does not say:

- **Scope is contagious upward.** A request-scoped provider makes every provider that injects it request-scoped too, all the way to the controller. One `Scope.REQUEST` deep in a graph can silently re-instantiate half the application per request.
- **Request-scoped classes do not get lifecycle hooks.** If a provider needs `onModuleInit`, it cannot be request-scoped.

Before reaching for `Scope.REQUEST` to carry per-request data, check whether passing the value as an argument works — it usually does, and it keeps the provider unit-testable without a request context.

## Optional and late-added dependencies

Adding a constructor parameter to a widely used service breaks every place that constructs it by hand — which, in a mature test suite, is usually specs that have nothing to do with the change and that no plan lists.

Two habits:

- Before declaring a constructor change safe, `grep` the **whole package** for `new <ServiceName>(`, not just the owning module. Hand-constructed services cluster in integration specs.
- Where the new collaborator is genuinely optional at construction time, make it a **trailing TypeScript-optional parameter without `@Optional()`**:

  ```ts
  constructor(
    private readonly repo: OrderRepository,
    private readonly audit?: AuditService,   // TS-optional, still injected by Nest
  ) {}
  ```

  Nest still treats it as a required dependency and fails loudly at boot if the module edge is missing, while hand-constructed call sites in specs you do not own keep compiling. `@Optional()` would give you the opposite trade: silent `undefined` at runtime.

Note that `tsc --noEmit` catches the constructor-arity break but a Jest run may not — `ts-jest` does not structurally check object literals, so a task that runs only its own tests can report success while the package does not typecheck. Run the typecheck.

## Circular dependencies

Two classes that inject each other need `forwardRef()` **on both sides**:

```ts
@Inject(forwardRef(() => CommonService))
private readonly commonService: CommonService;
```

and for modules:

```ts
@Module({ imports: [forwardRef(() => CatsModule)] })
```

The documented warning is the part to take seriously: *"the order of instantiation is indeterminate. Make sure your code does not depend on which constructor is called first. Having circular dependencies depend on providers with `Scope.REQUEST` can lead to undefined dependencies"* ([circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency)).

`forwardRef` is a repair, not a design. A cycle between two feature modules almost always means a shared concept wants to be extracted into a third module, or that one side should depend on a port rather than on the other module's class. `ModuleRef` — resolving one side lazily from the container — is the documented alternative when extraction is not on the table.

## Where the DI graph should be visible

`engineering-paved-path:onion-architecture` owns the question of *which* layer a provider belongs to. The DI-specific half of it:

- Concrete adapters and repositories are constructed by the container, never by `new` inside a service.
- A service takes ports and sibling collaborators; it does not reach into another module's provider list.
- Anything that reads the environment does so in a factory or in `ConfigService`, not in a repository — see [configuration.md](configuration.md).
