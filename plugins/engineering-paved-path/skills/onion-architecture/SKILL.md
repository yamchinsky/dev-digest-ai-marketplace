---
name: onion-architecture
description: "Layering and dependency-rule conventions for TypeScript backends (Fastify + Drizzle) with an optional pure-engine package. Use whenever editing or adding backend code; whenever adding a new module / use case / repository / adapter / outbound port / shared contract; whenever the question is *where should this live* on the backend (route vs service vs repository vs adapter vs platform vs shared); whenever reviewing a backend PR for layer violations (ORM in a service, SDK import in a route, `process.env` in a pure engine package, services importing other modules' services, SDK imports leaking past the adapter boundary). Trigger phrases: 'new endpoint', 'new module', 'where should this go', 'add a repository', 'add an adapter', 'wire up a port', 'consume X from a service', 'the engine needs to read', 'service is doing too much'. Layering and dependency placement ONLY — NOT Fastify runtime patterns (use engineering-paved-path:fastify-best-practices), NOT Drizzle query syntax (use engineering-paved-path:drizzle-orm-patterns), NOT Zod schema mechanics (use engineering-paved-path:zod). For the client side use engineering-paved-path:frontend-architecture."
version: 1.0.0
---

# Onion Architecture — backend layering

Where code lives in a layered TypeScript backend, and which way dependencies are allowed to point. **Layering decisions only** — not Fastify runtime (`engineering-paved-path:fastify-best-practices`), not Drizzle syntax (`engineering-paved-path:drizzle-orm-patterns`), not Zod mechanics (`engineering-paved-path:zod`).

This is a pragmatic onion variant: feature-modular outside, onion-layered inside. It codifies a working pattern — it does not propose refactors to classical `domain/application/infrastructure` rings, and it does not introduce a DI framework. The examples assume a Fastify + Drizzle API package (`src/`) and, where the project has one, a separate **pure engine package** (`engine/`) that holds domain computation with zero I/O. For concrete code skeletons, see [examples.md](examples.md). For sources and version history, see [README.md](README.md).

## Inputs

This skill assumes nothing about your repository beyond what you tell it. When applying it, first locate (or ask for): the API package root, the module directory (`src/modules/` or equivalent), the composition root (container), the shared contracts package, and whether a pure engine package exists. If the project documents its own layering rules, those take precedence.

## When to use this skill

- Adding a new module under `src/modules/`
- Adding a new outbound integration (DB, HTTP, LLM, third-party API, fs)
- Deciding where a piece of logic goes: route vs service vs repository vs adapter vs platform vs shared
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
| **Domain core** — entities, value objects, pure invariants, shared contracts | the shared contracts package (`shared/`); the pure engine package (`engine/src/`) when present | entity types; port interfaces (`LLMProvider`, `Embedder`, `PaymentGateway`) |
| **Application / use cases** — orchestration, no I/O of its own | `src/modules/<name>/service.ts`; the engine's orchestration entry point | `OrderService.placeOrder()`, a pipeline that composes pure steps |
| **Infrastructure adapters** — DB, HTTP, LLM, third-party APIs, fs, secrets, time | `src/adapters/<port>/*`, `src/modules/<name>/repository.ts`, `src/db/` | SDK-backed providers, Drizzle repositories |
| **Presentation** — HTTP edge, schemas, error envelope, SSE, plugins | `src/modules/<name>/routes.ts`, `src/platform/*` | Zod request/response schemas, global error handler, event bus |

**Dependency Rule** (concrete, enforce in review):

- `routes.ts` may import `service.ts`, Zod schemas, the context helper, `_shared/`. **Never** Drizzle, **never** a third-party SDK, **never** `db/`, **never** an adapter directly.
- `service.ts` may import the `Container`, its sibling `repository.ts`, the shared contracts package, the engine package. **Never** Fastify, **never** another module's service, **never** raw adapters (always via the `Container`).
- `repository.ts` is the **only** place Drizzle is imported in a module. It may import shared contract types and `db/schema`. It must **not** import Fastify, adapters, or another module's repository.
- `adapters/<port>/*.ts` implements a port interface from the shared contracts package. May import third-party SDKs freely; **never** imports Fastify, **never** imports `db/`, **never** imports a module's service or repository.
- The pure engine package may **never** import the HTTP framework, the ORM, the DB driver, or outbound SDKs, and may **never** touch `node:fs`, `node:path`, `node:child_process` or read `process.env`. Its only side effects go through injected ports.

---

## 2. Module skeleton — the non-negotiable triple (CRITICAL)

Every feature module is a folder under `src/modules/<name>/`:

```
modules/<name>/
  routes.ts        # Fastify plugin: Zod schemas + thin handlers
  service.ts       # business logic; constructor(container: Container)
  repository.ts    # Drizzle queries; module-internal
```

Then register the module explicitly (one import + one entry in `src/modules/index.ts`). Prefer static registration over filesystem autoload — the module list should be reviewable in one file.

### Route handler shape

The handler does exactly three things, in this order:

1. `await getContext(container, req)` — tenant/workspace scoping + auth, extracted once by a shared context helper
2. Call the service
3. Return the result (Fastify serializes; the route's Zod response schema validates)

Validation happens via `fastify-type-provider-zod` **before** the handler runs. **Never** `Schema.parse(req.body)` inside a handler — that bypasses the 422 path.

### Service shape

```ts
export class FooService {
  private repo: FooRepository;
  constructor(private container: Container) {
    this.repo = new FooRepository(container.db);
  }
  async doThing(workspaceId: string, input: Input): Promise<Output> { /* … */ }
}
```

Adapters resolve lazily via the container (`container.llm(id)`, `container.payments()`, …). **Never** `new SomeSdkProvider(...)` in a service.

When you need a side effect that does not yet have a port, add a port (see §3) — do **not** import the SDK in the service.

### Repository shape

The only Drizzle importer in the module. Returns either raw Drizzle row types (for module-internal use) or shared contract types when the data flows out to the service / API. **Don't** return raw Drizzle row types from a service — map at the boundary (see §5).

For multi-aggregate modules, split into `repository/<aggregate>.repo.ts` and compose them in `repository.ts`.

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
| Port interface | the shared contracts package (e.g. `shared/adapters.ts`) | Shared contracts live in one place so both the API package and the engine can import them |
| Concrete adapter | `src/adapters/<port>/<impl>.ts` | E.g. `adapters/embedder/openai.ts`, `adapters/payments/stripe.ts` |
| Adapter barrel | `src/adapters/index.ts` | Re-exports concrete classes |
| Mock for tests | `src/adapters/mocks.ts` | All port mocks live together |
| DI registration | `src/platform/container.ts` | Lazy getter, cached, env-gated where applicable |

### Engine ports

The engine's entry point declares its inputs as a typed input struct whose port fields (e.g. `llm: LLMProvider`) come from the shared contracts package. The engine never news up a provider — the host application does, and passes it in. If the engine ever needs a *new* outbound (e.g. a search index), add a port to the shared contracts, declare it on the input struct, and let the host pass a concrete adapter.

### Gated adapters

A container resolver behind a feature flag (e.g. `container.embedder()` when `EMBEDDINGS_ENABLED=false`) throws a typed `ConfigError` **before** constructing the SDK client. Match this pattern for any new adapter behind a flag — the gate must fire before any third-party SDK constructor runs.

### Anti-patterns

- A service importing an SDK (`openai`, `stripe`, `@octokit/rest`) directly → push behind an existing or new port.
- An adapter importing `db/schema` → that's a repository, not an adapter.
- Two near-identical adapters for the same port → keep one, parameterise.

See [examples.md](examples.md) — *Example 2: Adding a new outbound port*.

---

## 4. Where logic goes — decision table (CRITICAL)

The single most-asked question. Look it up here before writing.

| Kind of logic | Goes in | Anti-pattern |
|---|---|---|
| HTTP schema, request parsing, response shaping | `routes.ts` (Zod, `fastify-type-provider-zod`) | Business branching inside the handler body |
| Tenant/workspace scoping, auth pull from `req` | the shared context helper at the top of the handler, then pass `workspaceId` to the service | Reading `req` inside `service.ts` |
| Orchestration of multiple adapters / repos / engine calls | `service.ts` | A repository calling another repository |
| Single-aggregate read/write, SQL | `repository.ts` (or `repository/<aggregate>.repo.ts`) | `db.select(...)` outside a repo file |
| Cross-cutting infrastructure: pricing, SSE, model routing, error taxonomy, resilience, run logging | `src/platform/*` | Re-implementing one of these inside a module |
| Pure domain computation (assembly, validation pipelines, map-reduce, output shaping) | the engine package when present, else a pure module in `src/` | Burying pure computation inside an I/O-bound service (kills reuse from CLI/CI entry points) |
| Outbound HTTP / LLM / third-party / fs call | `src/adapters/<port>/<impl>.ts` (behind a port interface) | Importing the SDK directly in a service |
| Shared Zod contract or port interface (cross-module / cross-package) | the shared contracts package | Redefining the same entity type in two packages |
| Module-internal helpers (DTO mappers, small pure functions) | `modules/<name>/helpers.ts` (or `.ts` siblings) | Promoting one-shot helpers to `platform/` |
| Mocks for tests | `src/adapters/mocks.ts` | A per-module `__mocks__/` directory |

---

## 5. Zod three-way split (HIGH)

Zod schemas serve three distinct purposes — do **not** merge them.

| Purpose | Where it lives | Why separate |
|---|---|---|
| **Transport DTO** (HTTP request / response) | `routes.ts` (declared inline next to the route) or `_shared/schemas.ts` for cross-module ids | Untrusted input; tolerant parsing; errors become `422` via the route plugin and the API error envelope |
| **Domain invariant** (the canonical shape of a core entity) | the shared contracts package | Single source of truth consumed by every package |
| **Adapter decoder** (Drizzle row → entity, third-party response → typed result) | Private to the repository / adapter file | DB and domain shapes drift; keep ORM types from leaking up the rings |

Share atoms (enums, branded ids) via composition — `z.object({ ...IdParams.shape, ... })` — not by reusing one whole schema across two purposes "to save lines". When the schemas have drifted enough that you're tempted to fork them, **fork them.**

For `/:id` where the id is a uuid (DB primary key), reuse a shared `IdParams` schema from `modules/_shared/schemas.ts`. Only define a fresh schema when the id is not a uuid (e.g. `/providers/:id` where id is a provider name).

---

## 6. Pure-engine purity invariants (CRITICAL)

If the project has a pure engine package, run this checklist *before* writing any code in it:

- [ ] No `process.env` reads — all inputs are function arguments.
- [ ] No `node:fs`, `node:path`, `node:child_process`. (Pure `node:crypto`, `node:util` is fine.)
- [ ] No ORM, DB driver, HTTP framework, or outbound SDK imports.
- [ ] External calls (LLM, APIs) go through injected port arguments, not SDK constructors inside the engine.
- [ ] Mandatory domain gates always run: if the engine defines a post-processing/validation step on its output (e.g. a grounding or invariant check), every code path runs it — callers must not be able to bypass it.
- [ ] Optional input slots silently no-op when empty — don't throw, don't insert placeholder output.
- [ ] New public types / functions are added to the engine's `src/index.ts` (the entire public surface). Anything not re-exported there is package-internal.

**If you need to read a file, call an API, or look at an env var** — that work belongs in the **host application**, which then plumbs the result into the engine as an argument. See [examples.md](examples.md) — *Example 3: Adding capability to the engine*.

This invariant is what lets the same engine code run unchanged from other entry points (CLI, CI runner). Don't break it for ergonomics.

---

## 7. DI & the Container (HIGH)

- **One composition root**: `src/platform/container.ts`. Don't create a second.
- Services constructor signature: `constructor(container: Container)`. Adapters resolve via container getters — all cached.
- Tests inject mocks via a `ContainerOverrides` interface declared next to the container. Production code must never construct a concrete adapter directly.
- **No decorator DI** (no `tsyringe`, no `@injectable`) — and especially never inside the pure engine. Decorator-based DI couples the domain to a runtime container, breaking the tenet that the core must run without infrastructure. Manual composition is sufficient.
- New adapter that depends on a secret? After persisting the secret, invalidate the container's secret-derived caches so the next resolve picks it up.
- New gated adapter? Throw a typed config error from the container resolver *before* the SDK constructor runs (see §3, gated adapters).

---

## 8. Cross-package boundary rules (HIGH)

- Cross-package imports go through explicit aliases (tsconfig `paths` or workspace packages) — **never** relative `../../other-package/src/...`.
- Pick **one** consumption mode per internal package — TS source via alias, or built artifact — and don't mix them; mixing produces duplicate type identities and stale-build bugs.
- If the repo's tooling requires ESM `.js` suffixes on relative imports (tsx, NodeNext), apply them consistently within a package — half-migrated imports break at runtime, not compile time.
- A shared implementation needed by more than one entry point (server + CI runner, server + CLI) belongs in the innermost package that all consumers can import — don't duplicate it per entry point.

---

## 9. Testing implications (MEDIUM)

A filename convention that splits hermetic tests from infrastructure-backed tests (e.g. `*.it.test.ts` for the latter) maps directly to the rings:

| Ring | Test type | Filename |
|---|---|---|
| Domain (engine, shared contracts) | Unit, hermetic, fast | no `.it.` suffix |
| Application (`src/modules/<name>/service.ts`) | Unit with fake ports via `ContainerOverrides` | no `.it.` suffix |
| Infrastructure (`src/adapters/**`, `src/modules/<name>/repository.ts`) | Integration, testcontainers DB / recorded transport | `*.it.test.ts` |
| Presentation (routes) | Smoke / contract via Fastify inject | usually unit |

**Rule of thumb:** if a "unit" test needs a real DB or network, the dependency points outward — fix the layering, not the test. Push the dependency behind a port.

Reach for the shared `src/adapters/mocks.ts` rather than ad-hoc stubs.

---

## 10. When NOT to use Onion (MEDIUM)

Escape hatch for true CRUD with no branching:

- A pure get/put endpoint can have a thin service that delegates to one repo method and immediately returns. Don't invent fake "use cases" with no logic.
- A small read-only module may not need `service.ts` at all — but keep `repository.ts` separate, because Drizzle must never leak into `routes.ts`.

Don't apply this escape hatch when:

- There is *any* branching, retry, fan-out, or side-effect composition.
- The endpoint is tenant/workspace-scoped (always go through the context helper).
- The endpoint touches >1 adapter or repo.

---

## 11. Common pitfalls catalog

One-line smell → one-line fix.

- **Drizzle types leaking out of `repository.ts`** → map to a domain shape (shared contract type) at the boundary.
- **Vendor SDK imported in `service.ts`** → push behind an existing port or add a new one.
- **`process.env` read inside the pure engine** → take the value as a function argument; the host reads env and plumbs it in via the `Container`.
- **`service.ts` instantiating another module's service** → if cross-module orchestration is needed, the dep belongs in `platform/`, or factor a port that both depend on.
- **One Zod schema serving HTTP and DB row decoding** → fork per §5.
- **Route handler doing more than `parse → call service → return`** → move the logic into the service.
- **Adapter caught and rethrown with a richer error** → throw the right typed application error (e.g. `ExternalServiceError` for adapter failures), let the global handler render the API error envelope.
- **A new long-running job kind that isn't reaped on boot** → add it to the service's stale-run reaper (or equivalent) — orphaned `running` rows leak otherwise.
- **`Schema.parse(req.body)` inside a handler** → declare the schema on the route's `body` / `params` / `querystring` so 422 happens before the handler.
- **`reply.status(500).send({ error: ... })`** → throw a typed application error; the global handler owns the envelope.
- **`service.ts` method accepts `FastifyRequest`, `FastifyReply`, or any `fastify` type as a parameter** → pass only domain values (`workspaceId`, `userId`, validated body struct). Fastify types must not cross the `routes.ts → service.ts` boundary: they couple the service to the HTTP layer, make unit testing impossible without a real Fastify instance, and break the onion invariant that the application layer has no knowledge of the delivery mechanism (§14).
- **`service.ts` importing another module's `repository.ts` directly** → define a port interface in the shared contracts package (e.g. `AgentLookup`) or call the sibling's service; never cross the module boundary at the ORM layer (§13).

---

## 12. Decision flowchart (one-page summary)

```
NEW BACKEND FILE → WHAT IS IT?

├── HTTP endpoint
│    └── modules/<name>/routes.ts
│        (handler = getContext → service.call → return)
│
├── Business logic / orchestration
│    └── modules/<name>/service.ts
│        (constructor(container: Container))
│
├── DB query (Drizzle)
│    ├── single aggregate → modules/<name>/repository.ts
│    └── multi-aggregate  → modules/<name>/repository/<aggregate>.repo.ts
│
├── Outbound SDK call (LLM / HTTP / third-party / fs)
│    ├── port interface  → shared contracts package (adapters.ts)
│    ├── concrete impl   → src/adapters/<port>/<impl>.ts
│    ├── re-export       → src/adapters/index.ts
│    ├── DI wiring       → src/platform/container.ts
│    └── test mock       → src/adapters/mocks.ts
│
├── Cross-cutting (pricing, SSE, model routing, error taxonomy, resilience)
│    └── src/platform/<topic>.ts
│
├── Shared contract / type / port interface
│    └── shared contracts package ({contracts,adapters}.ts)
│
├── Pure domain computation (assembly / validation / map-reduce / shaping)
│    └── engine package src/… (export from src/index.ts if a consumer should see it)
│
├── Module-internal helper / DTO mapper
│    └── modules/<name>/helpers.ts
│
└── Test
     ├── DB-backed or testcontainers → *.it.test.ts
     └── Anything else (hermetic)    → *.test.ts (no .it. suffix)
```

---

## 13. `repository.ts` is module-private — no cross-module imports (CRITICAL)

A `repository.ts` file **belongs exclusively to its own module**. No file outside `modules/<name>/` may import from another module's `repository.ts`. This is the hard boundary that keeps ORM queries contained and prevents service-layer coupling from silently spreading across the tree.

**Violation example** (`webhooks/service.ts`):

```typescript
import { AgentsRepository } from '../agents/repository.js';   // ❌ CRITICAL
import { SkillsRepository } from '../skills/repository.js';   // ❌ CRITICAL
import { WebhooksRepository } from './repository.js';          // ✅ own module — correct
```

**Why it matters**: when a service reaches directly into a sibling module's repository, it bypasses any caching, telemetry, error translation, and invariant checks that the sibling service owns. It also makes schema migrations silently breaking across modules.

**Correct alternatives** (pick one):

| Need | Correct approach |
|------|-----------------|
| Read data from another module | Call that module's **service** (no direct repo access) |
| Shared lookup at construction time | Define a **port interface** in the shared contracts package (e.g. `AgentLookup`), register a concrete impl in the `Container`, inject via constructor |
| Validation that requires data from two modules | Lift the validation into `platform/` as a cross-cutting helper, or wire both services through the Container |

**How to detect**: search for `import … from '…/modules/<name>/repository'` (or `.repo`) in any file whose own path is outside `modules/<name>/` — every hit is a violation.

---

## 14. Fastify-type isolation (CRITICAL)

Services must be callable from a unit test with zero Fastify machinery. If a service method signature includes `FastifyRequest`, `FastifyReply`, `FastifyInstance`, or any import from the `fastify` package, the service is coupled to the presentation layer — a hard ring violation.

**Violation shape:**
```ts
// ❌ routes.ts
async (req, reply) => {
  await service.process(req);       // passes req wholesale
  await service.notify(reply, id);  // passes reply
}
```

**Correct shape:**
```ts
// ✓ routes.ts — extract domain values, pass those
async (req, reply) => {
  const { workspaceId, userId } = await getContext(container, req);
  const result = await service.process(workspaceId, req.body.input);
  return result;
}

// ✓ service.ts — knows nothing about Fastify
async process(workspaceId: string, input: ProcessInput): Promise<ProcessResult> { … }
```

If the service needs something from the request beyond what the context helper returns, extract it in the route handler and pass the domain value explicitly.

---

For concrete code skeletons of each common task, see [examples.md](examples.md).
