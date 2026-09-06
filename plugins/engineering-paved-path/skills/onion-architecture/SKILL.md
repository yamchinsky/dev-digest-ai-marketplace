---
name: onion-architecture
description: "Layering and dependency-rule conventions for TypeScript backends, with an optional pure-engine package. Use whenever editing or adding backend code; whenever adding a new module / use case / repository / adapter / outbound port / shared contract; whenever the question is *where should this live* on the backend (HTTP edge vs service vs repository vs adapter vs platform vs shared); whenever reviewing a backend PR for layer violations (ORM in a service, SDK import in a controller, `process.env` in a pure engine package, services importing other modules' services, SDK imports leaking past the adapter boundary). Trigger phrases: 'new endpoint', 'new module', 'where should this go', 'add a repository', 'add an adapter', 'wire up a port', 'consume X from a service', 'the engine needs to read', 'service is doing too much'. Layering and dependency placement ONLY — NOT NestJS runtime and wiring mechanics (use engineering-paved-path:nestjs-best-practices), NOT TypeORM query and migration mechanics (use engineering-paved-path:typeorm-patterns), NOT Zod schema mechanics (use engineering-paved-path:zod). For the client side use engineering-paved-path:frontend-architecture."
version: 1.1.0
---

# Onion Architecture — backend layering

Where code lives in a layered TypeScript backend, and which way dependencies are allowed to point. **Layering decisions only** — not framework runtime (`engineering-paved-path:nestjs-best-practices`), not ORM syntax (`engineering-paved-path:typeorm-patterns`), not Zod mechanics (`engineering-paved-path:zod`).

This is a pragmatic onion variant: feature-modular outside, onion-layered inside. It codifies a working pattern — it does not propose refactors to classical `domain/application/infrastructure` rings. The rules are stated in framework-neutral terms; the concrete examples in [examples.md](examples.md) are written in **NestJS + TypeORM**, which is one instantiation of them, not a requirement. Where the project has one, a separate **pure engine package** holds domain computation with zero I/O. For sources and version history, see [README.md](README.md).

## Inputs

This skill assumes nothing about your repository beyond what you tell it. When applying it, first locate (or ask for): the API package root, the module directory (`src/modules/` or equivalent), the composition root, the shared contracts package, and whether a pure engine package exists. If the project documents its own layering rules, those take precedence.

## Vocabulary

Every rule below is written in the neutral column. Read it in whichever column your stack uses.

| Neutral term | NestJS + TypeORM | A framework-less / plain-HTTP setup |
|---|---|---|
| **Feature module** | a `@Module()` with its controller, service, repository and DTOs | a folder plus a route-registration function |
| **HTTP edge** | `<name>.controller.ts` | `routes.ts` |
| **Application service** | `<name>.service.ts` (`@Injectable()`) | `service.ts` |
| **Repository** | `<name>.repository.ts` holding an injected `Repository<T>` / `DataSource` | `repository.ts` holding the ORM client |
| **Composition root** | the module handed to `NestFactory.create()` — `app.module.ts` | a hand-written container module |
| **DI mechanism** | the framework container: providers, tokens, `@Inject` | a manually constructed container object |
| **Port** | an interface plus a DI token (`Symbol`) | an interface plus a container getter |
| **Adapter** | a provider bound to that token, usually through a factory | a class constructed in the container |

## When to use this skill

- Adding a new module under `src/modules/`
- Adding a new outbound integration (DB, HTTP, LLM, third-party API, fs)
- Deciding where a piece of logic goes: HTTP edge vs service vs repository vs adapter vs platform vs shared
- Adding capability to a pure engine package without breaking its purity
- Reviewing a backend PR for layer violations
- Resolving "should this be a port?" debates

## Severity levels

- **CRITICAL** — wrong choice rots the architecture or breaks an invariant the rest of the system depends on
- **HIGH** — wrong choice creates lasting maintenance friction
- **MEDIUM** — wrong choice hurts DX but is locally fixable

---

## 1. The four-ring model (CRITICAL)

Four rings, dependencies point inward.

| Ring | Lives in | Examples |
|---|---|---|
| **Domain core** — entities, value objects, pure invariants, shared contracts | the shared contracts package (`shared/`); the pure engine package (`engine/src/`) when present | domain types; port interfaces (`LLMProvider`, `Embedder`, `PaymentGateway`) |
| **Application / use cases** — orchestration, no I/O of its own | `src/modules/<name>/service.ts`; the engine's orchestration entry point | `OrderService.placeOrder()`, a pipeline that composes pure steps |
| **Infrastructure adapters** — DB, HTTP, LLM, third-party APIs, fs, secrets, time | `src/adapters/<port>/*`, `src/modules/<name>/repository.ts`, `src/db/` | SDK-backed providers, ORM-backed repositories |
| **Presentation** — HTTP edge, request/response schemas, error envelope, streaming, cross-cutting enhancers | `src/modules/<name>/controller.ts`, `src/platform/*` | request/response schemas, the global exception filter, the event bus |

**Dependency Rule** (concrete, enforce in review):

- The **HTTP edge** may import its service, its request/response schemas, the context helper, `_shared/`. **Never** the ORM, **never** a third-party SDK, **never** `db/`, **never** an adapter directly.
- The **service** may import its sibling repository, ports (by token or interface), the shared contracts package, the engine package. **Never** the HTTP framework's request/response types, **never** another module's service reached around its module boundary, **never** a concrete adapter class.
- The **repository** is the **only** place the ORM is imported in a module. It may import shared contract types and the schema/entity definitions. It must **not** import the HTTP framework, adapters, or another module's repository. It must **not** read configuration — see §4.
- `adapters/<port>/*.ts` implements a port interface from the shared contracts package. May import third-party SDKs freely; **never** imports the HTTP framework, **never** imports `db/`, **never** imports a module's service or repository.
- The pure engine package may **never** import the HTTP framework, the ORM, the DB driver, or outbound SDKs, and may **never** touch `node:fs`, `node:path`, `node:child_process` or read `process.env`. Its only side effects go through injected ports.

---

## 2. Module skeleton — the non-negotiable triple (CRITICAL)

Every feature module is a folder under `src/modules/<name>/` containing, at minimum:

```
modules/<name>/
  <edge>          # HTTP edge: request/response schemas + thin handlers
  <service>       # business logic
  <repository>    # ORM queries; module-internal
```

In NestJS that is `<name>.controller.ts` / `<name>.service.ts` / `<name>.repository.ts`, plus a `<name>.module.ts` that wires **this module only**.

Then register the module explicitly in **one** place — the composition root. Prefer static registration over filesystem autoload: the module list should be reviewable in one file. A feature module may import one other feature module it genuinely depends on; what the rule forbids is a *second composition root* — a feature module that gathers three or more others.

### Edge handler shape

The handler does exactly three things, in this order:

1. resolve the caller's context (tenant/workspace scoping + identity), extracted once by a shared helper or a parameter decorator
2. call the service, passing **domain values only**
3. return the result (the framework serialises)

Validation happens **before** the handler runs — a declared request schema, or a globally registered validation pipe. **Never** parse the raw body inside a handler; that bypasses the framework's error path and with it the whole error envelope.

### Service shape

The service receives its collaborators; it never constructs them.

```ts
export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    @Inject(PAYMENTS) private readonly payments: PaymentGateway,
  ) {}

  async placeOrder(workspaceId: string, input: PlaceOrderInput): Promise<Order> { /* … */ }
}
```

**Never** `new SomeSdkProvider(...)` in a service. When you need a side effect that does not yet have a port, add a port (§3) — do **not** import the SDK.

### Repository shape

The only ORM importer in the module. Returns either module-internal row/entity types, or shared contract types when the data flows out to the service / API. **Don't** return raw ORM entity types from a service — map at the boundary (§5).

For multi-aggregate modules, split into `repository/<aggregate>.repo.ts` and compose them.

See the full skeleton in [examples.md](examples.md) — *Example 1: New module from scratch*.

---

## 3. Ports & adapters (HIGH)

### When to add a new port

Add a port when **any** is true:

- The dependency is an outbound side effect: DB, HTTP, LLM, fs, env, time, randomness.
- You want to fake it in unit tests (= cannot run the real thing in a hermetic test).
- More than one concrete implementation is plausible (real + mock; or several vendors for the same capability).

### Where each piece lives

| Piece | Path | Notes |
|---|---|---|
| Port interface | the shared contracts package (e.g. `shared/adapters.ts`), or the module's `ports/` when it is module-local | Shared contracts live in one place so both the API package and the engine can import them |
| DI token | `<name>.tokens.ts` — a `Symbol` or a `const`, never an inline string literal | An interface has no runtime identity; the token is what makes it injectable |
| Concrete adapter | `src/adapters/<port>/<impl>.ts`, or the module's `adapters/` | E.g. `adapters/embedder/openai.ts`, `adapters/payments/stripe.ts` |
| Factory | `<port>.factory.ts` | Chooses the implementation and holds the safety checks |
| Mock for tests | `src/adapters/mocks.ts` | All port mocks live together |
| Binding | the composition root, or the owning module's provider list | Bind the **token** to the **factory**, not to the concrete class |

### Bind through the factory, always

If a factory exists for an adapter, it exists for a reason — a credential check, an environment gate, a boot-time validation. A second module that binds the raw class to the same token silently loses that guard for everything routed through it. When another module needs a port that one module already provides through a factory, reuse the factory or import the exporting module. Never re-bind the concrete class.

### Gated adapters

A resolver behind a feature flag must throw a typed configuration error **before** constructing the SDK client. Match this pattern for any new adapter behind a flag — the gate fires before any third-party constructor runs, so a disabled integration cannot fail on a missing credential.

Know the operational cost: a fail-closed factory that requires a new variable means the process **does not boot** without it, not that the feature is off. That is the right default, and it makes the config change and the code change a single deploy.

### Engine ports

The engine's entry point declares its inputs as a typed input struct whose port fields (e.g. `llm: LLMProvider`) come from the shared contracts package. The engine never constructs a provider — the host application does, and passes it in. If the engine ever needs a *new* outbound (e.g. a search index), add a port to the shared contracts, declare it on the input struct, and let the host pass a concrete adapter.

### Anti-patterns

- A service importing an SDK (`openai`, `stripe`, `@octokit/rest`) directly → push behind an existing or new port.
- An adapter importing the DB schema → that's a repository, not an adapter.
- Two near-identical adapters for the same port → keep one, parameterise.
- A port bound by `useClass` in one module and by a factory in another → one binding, through the factory.

See [examples.md](examples.md) — *Example 2: Adding a new outbound port*.

---

## 4. Where logic goes — decision table (CRITICAL)

The single most-asked question. Look it up here before writing.

| Kind of logic | Goes in | Anti-pattern |
|---|---|---|
| HTTP schema, request parsing, response shaping | the module's HTTP edge (DTOs / route schemas) | Business branching inside the handler body |
| Tenant/workspace scoping, identity pulled off the request | a shared context helper or parameter decorator at the top of the handler, then pass `workspaceId` to the service | Reading the request object inside the service |
| Orchestration of multiple adapters / repos / engine calls | the service | A repository calling another repository |
| Single-aggregate read/write, SQL | the repository (or `repository/<aggregate>.repo.ts`) | A query built outside a repository file |
| Reading configuration or the environment | a factory, or the configuration service consumed by a service | A repository reading `process.env` — pass the resolved value in as a parameter |
| Cross-cutting infrastructure: pricing, streaming, model routing, error taxonomy, resilience, run logging | `src/platform/*` | Re-implementing one of these inside a module |
| Pure domain computation (assembly, validation pipelines, map-reduce, output shaping) | the engine package when present, else a pure module in `src/` | Burying pure computation inside an I/O-bound service (kills reuse from CLI/CI entry points) |
| Outbound HTTP / LLM / third-party / fs call | `src/adapters/<port>/<impl>.ts` (behind a port interface) | Importing the SDK directly in a service |
| Shared contract or port interface (cross-module / cross-package) | the shared contracts package | Redefining the same entity type in two packages |
| Module-internal helpers (DTO mappers, small pure functions) | `modules/<name>/<name>.mappers.ts` or a sibling file | Promoting one-shot helpers to `platform/` |
| Mocks for tests | `src/adapters/mocks.ts` | A per-module `__mocks__/` directory |

---

## 5. The three-way schema split (HIGH)

Schemas serve three distinct purposes — do **not** merge them.

| Purpose | Where it lives | Why separate |
|---|---|---|
| **Transport DTO** (HTTP request / response) | the module's HTTP edge (a DTO class, or a schema declared next to the route), or `_shared/` for cross-module ids | Untrusted input; tolerant parsing; errors become a `4xx` via the framework's validation path and the API error envelope |
| **Domain invariant** (the canonical shape of a core entity) | the shared contracts package | Single source of truth consumed by every package |
| **Persistence shape** (ORM entity / row type) | the entity definition, private to the repository | DB and domain shapes drift; keep ORM types from leaking up the rings |

Share atoms (enums, branded ids) by composition, not by reusing one whole schema across two purposes "to save lines". When the schemas have drifted enough that you're tempted to fork them, **fork them.**

For a `/:id` route where the id is a uuid, reuse a shared id schema. Only define a fresh one when the id is not a uuid (e.g. `/providers/:id` where the id is a provider name).

Where a database enum and a contract's literal union deliberately differ, convert through an exhaustive lookup map — and audit the **read** path as carefully as the write path; the write conversion is the visible one and creates a false sense of coverage.

---

## 6. Pure-engine purity invariants (CRITICAL)

If the project has a pure engine package, run this checklist *before* writing any code in it:

- [ ] No `process.env` reads — all inputs are function arguments.
- [ ] No `node:fs`, `node:path`, `node:child_process`. (Pure `node:crypto`, `node:util` is fine.)
- [ ] No ORM, DB driver, HTTP framework, or outbound SDK imports.
- [ ] **No dependency on a DI container** — not the framework's, not a third-party one. The engine takes its collaborators as arguments (§7).
- [ ] External calls (LLM, APIs) go through injected port arguments, not SDK constructors inside the engine.
- [ ] Mandatory domain gates always run: if the engine defines a post-processing/validation step on its output (e.g. a grounding or invariant check), every code path runs it — callers must not be able to bypass it.
- [ ] Optional input slots silently no-op when empty — don't throw, don't insert placeholder output.
- [ ] New public types / functions are added to the engine's `src/index.ts` (the entire public surface). Anything not re-exported there is package-internal.

**If you need to read a file, call an API, or look at an env var** — that work belongs in the **host application**, which then plumbs the result into the engine as an argument. See [examples.md](examples.md) — *Example 3: Adding capability to the engine*.

This invariant is what lets the same engine code run unchanged from other entry points (CLI, CI runner). Don't break it for ergonomics.

---

## 7. Composition root & DI (HIGH)

- **One composition root.** Every application has exactly one place where the object graph is assembled. Don't create a second.
- **Use the framework's DI where the framework provides one.** In NestJS, DI *is* the framework: the composition root is the module handed to `NestFactory.create()`, services declare their collaborators as constructor parameters, and adapters are bound to tokens in a provider list. Working around that with a hand-rolled container is not "more onion" — it is a second graph nobody can see. The mechanics live in `engineering-paved-path:nestjs-best-practices`.
- **Where the framework provides no container, manual composition is sufficient.** A container module with lazy, cached getters is greppable, typed, and needs no decorators. Don't add a DI library to a codebase that doesn't have one just to have one.
- **Production code never constructs a concrete adapter.** Whichever mechanism you use, `new ConcreteAdapter()` outside the composition root (or its factories) is the violation to look for in review.
- **Tests inject fakes through the same seam** — an overrides interface for a manual container, the framework's provider-override API for a framework container. A test that reaches past the seam to monkey-patch a module is testing something else.
- **The pure engine package stays container-free** regardless. Decorator-based DI inside the domain couples the core to a runtime container and breaks the tenet that the core must run without infrastructure (§6). This is a rule about the *engine*, not about the application: it is not an argument against the application's framework DI.
- New adapter that depends on a secret? After persisting or rotating the secret, invalidate any secret-derived caches so the next resolution picks it up.
- New gated adapter? Throw a typed configuration error from the factory *before* the SDK constructor runs (§3).

---

## 8. Cross-package boundary rules (HIGH)

- Cross-package imports go through explicit aliases (tsconfig `paths` or workspace packages) — **never** relative `../../other-package/src/...`.
- Pick **one** consumption mode per internal package — TS source via alias, or built artifact — and don't mix them; mixing produces duplicate type identities and stale-build bugs.
- If the repo's tooling requires ESM `.js` suffixes on relative imports, apply them consistently within a package — half-migrated imports break at runtime, not compile time.
- A shared implementation needed by more than one entry point (server + CI runner, server + CLI) belongs in the innermost package that all consumers can import — don't duplicate it per entry point.

---

## 9. Testing implications (MEDIUM)

A filename convention that splits hermetic tests from infrastructure-backed tests maps directly to the rings:

| Ring | Test type | Filename |
|---|---|---|
| Domain (engine, shared contracts) | Unit, hermetic, fast | `*.spec.ts` |
| Application (`src/modules/<name>/service`) | Unit with fake ports | `*.spec.ts` |
| Infrastructure (`src/adapters/**`, `src/modules/<name>/repository`) | Integration: real DB / recorded transport | `*.integration-spec.ts` |
| Presentation (the HTTP edge) | Smoke / contract against a booted app | `*.e2e-spec.ts` |

**Rule of thumb:** if a "unit" test needs a real DB or network, the dependency points outward — fix the layering, not the test. Push the dependency behind a port.

Reach for the shared `src/adapters/mocks.ts` rather than ad-hoc stubs.

One caveat the rings do not tell you: a hermetic test that constructs a service directly proves the *logic* and nothing about the *wiring*. Keep at least one test per module that compiles the real module graph — that is the only lane where a broken DI edge shows up.

---

## 10. When NOT to use Onion (MEDIUM)

Escape hatch for true CRUD with no branching:

- A pure get/put endpoint can have a thin service that delegates to one repo method and immediately returns. Don't invent fake "use cases" with no logic.
- A small read-only module may not need a service at all — but keep the repository separate, because the ORM must never leak into the HTTP edge.

Don't apply this escape hatch when:

- There is *any* branching, retry, fan-out, or side-effect composition.
- The endpoint is tenant/workspace-scoped (always go through the context helper).
- The endpoint touches >1 adapter or repo.

---

## 11. Common pitfalls catalog

One-line smell → one-line fix.

- **ORM entity types leaking out of the repository** → map to a domain shape (shared contract type) at the boundary.
- **Vendor SDK imported in a service** → push behind an existing port or add a new one.
- **`process.env` read inside the pure engine** → take the value as a function argument; the host reads env and plumbs it in.
- **`process.env` read inside a repository** → pass the resolved value as a method parameter; the repository owns DB I/O only.
- **A service instantiating another module's service** → if cross-module orchestration is needed, the dep belongs in `platform/`, or factor a port that both depend on.
- **One schema serving HTTP and DB row decoding** → fork per §5.
- **Handler doing more than `context → call service → return`** → move the logic into the service.
- **Adapter caught and rethrown with a richer error string** → throw the right typed application error, let the global handler render the API error envelope.
- **A new long-running job kind that isn't reaped on boot** → add it to the stale-run reaper — orphaned `running` rows leak otherwise.
- **Parsing the request body by hand inside a handler** → declare the schema on the route so validation happens before the handler.
- **Building an error response inline** → throw a typed application error; the global handler owns the envelope.
- **A service method accepting the framework's request/response type as a parameter** → pass only domain values (§14).
- **A service importing another module's repository directly** → define a port in the shared contracts package or call the sibling's service; never cross the module boundary at the ORM layer (§13).
- **A port bound to a raw adapter class in a second module** → bind through the factory (§3).

---

## 12. Decision flowchart (one-page summary)

```
NEW BACKEND FILE → WHAT IS IT?

├── HTTP endpoint
│    └── modules/<name>/  ← the module's HTTP edge
│        (handler = context → service.call → return)
│
├── Business logic / orchestration
│    └── modules/<name>/  ← the service
│
├── DB query
│    ├── single aggregate → modules/<name>/  ← the repository
│    └── multi-aggregate  → modules/<name>/repository/<aggregate>.repo.ts
│
├── Outbound SDK call (LLM / HTTP / third-party / fs)
│    ├── port interface  → shared contracts package (adapters.ts)
│    ├── DI token        → modules/<name>/<name>.tokens.ts
│    ├── concrete impl   → src/adapters/<port>/<impl>.ts
│    ├── factory         → <port>.factory.ts  (safety checks live here)
│    ├── binding         → the composition root / owning module
│    └── test mock       → src/adapters/mocks.ts
│
├── Cross-cutting (pricing, streaming, model routing, error taxonomy, resilience)
│    └── src/platform/<topic>.ts
│
├── Shared contract / type / port interface
│    └── shared contracts package ({contracts,adapters}.ts)
│
├── Pure domain computation (assembly / validation / map-reduce / shaping)
│    └── engine package src/… (export from src/index.ts if a consumer should see it)
│
├── Module-internal helper / DTO mapper
│    └── modules/<name>/<name>.mappers.ts
│
└── Test
     ├── DB-backed        → *.integration-spec.ts
     ├── Booted app       → *.e2e-spec.ts
     └── Anything else    → *.spec.ts
```

---

## 13. The repository is module-private — no cross-module imports (CRITICAL)

A repository file **belongs exclusively to its own module**. No file outside `modules/<name>/` may import it. This is the hard boundary that keeps ORM queries contained and prevents service-layer coupling from silently spreading across the tree.

**Violation example:**

```typescript
// modules/webhooks/webhooks.service.ts
import { AgentsRepository } from '../agents/agents.repository';   // ❌ CRITICAL
import { SkillsRepository } from '../skills/skills.repository';   // ❌ CRITICAL
import { WebhooksRepository } from './webhooks.repository';       // ✅ own module — correct
```

**Why it matters**: when a service reaches directly into a sibling module's repository, it bypasses any caching, telemetry, error translation and invariant checks that the sibling service owns. It also makes schema migrations silently breaking across modules.

**Correct alternatives** (pick one):

| Need | Correct approach |
|------|-----------------|
| Read data from another module | Call that module's **service** (no direct repo access) |
| Shared lookup at construction time | Define a **port interface** in the shared contracts package, bind a concrete impl in the composition root, inject it |
| Validation that requires data from two modules | Lift the validation into `platform/` as a cross-cutting helper, or wire both services through the composition root |

**How to detect**: search for an import of `…/modules/<name>/…repository` in any file whose own path is outside `modules/<name>/` — every hit is a violation.

---

## 14. Delivery-framework type isolation (CRITICAL)

Services must be callable from a unit test with zero HTTP machinery. If a service method signature includes the framework's request, response, or execution-context type — or any import from the framework's HTTP package — the service is coupled to the presentation layer. That is a hard ring violation: it makes unit testing impossible without a live server, and it breaks the invariant that the application layer has no knowledge of the delivery mechanism.

**Violation shape:**
```ts
// ❌ the edge passes framework objects through
async (req, res) => {
  await service.process(req);        // passes the request wholesale
  await service.notify(res, id);     // passes the response
}
```

**Correct shape:**
```ts
// ✓ the edge extracts domain values and passes those
async (req, res) => {
  const { workspaceId, userId } = await getContext(req);
  return service.process(workspaceId, req.body.input);
}

// ✓ the service knows nothing about the delivery mechanism
async process(workspaceId: string, input: ProcessInput): Promise<ProcessResult> { … }
```

If the service needs something from the request beyond what the context helper returns, extract it at the edge and pass the domain value explicitly.

---

For concrete code skeletons of each common task, see [examples.md](examples.md).
