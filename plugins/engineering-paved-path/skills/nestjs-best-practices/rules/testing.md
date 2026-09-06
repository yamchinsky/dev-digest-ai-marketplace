---
name: testing
description: Test.createTestingModule, overrides, hermetic vs booted tests, and the failures only a real boot catches
metadata:
  tags: testing, testing-module, overrides, e2e, integration, fixtures
---

# Testing

## Three lanes, and what each one can prove

| Lane | Shape | Proves |
|---|---|---|
| **Hermetic unit** | `new Service(mock)` or a testing module with every collaborator overridden | the logic |
| **Integration** | a real database (or another real dependency), fake edges | the queries, the result shapes, the constraints |
| **End-to-end** | the whole application booted, requests over HTTP | the wiring, the enhancers, the status codes |

Give the lanes disjoint filename patterns (`*.spec.ts` / `*.integration-spec.ts` / `*.e2e-spec.ts`) so each can be run alone. That split is not cosmetic — the section below is a list of failures that are *structurally invisible* to the hermetic lane.

## The testing module

```ts
const moduleRef = await Test.createTestingModule({
  imports: [OrdersModule],
})
  .overrideProvider(PAYMENTS_PORT).useValue(fakePayments)
  .overrideGuard(GlobalAuthGuard).useValue({ canActivate: () => true })
  .compile();

const service = moduleRef.get(OrdersService);
```

`overrideProvider`, `overrideGuard`, `overrideInterceptor`, `overrideFilter` and `overridePipe` each accept `useValue` / `useClass` / `useFactory`.

**Close what you open.** The docs' own end-to-end example ends with `afterAll(async () => { await app.close(); })`, and it is not optional hygiene: an unclosed application keeps its database pool, its schedulers and its listeners alive for the rest of the run, which shows up as unrelated suites timing out.

## What only a real module compile catches

This is the reason to have a lane that compiles modules without overrides:

- **`Nest can't resolve dependencies of X`** from an `import type` on an injected class. Hermetic specs that construct the class directly pass at 100% — see [dependency-injection.md](dependency-injection.md).
- **A missing module edge.** A provider that a service injects but no module provides.
- **A guard or filter that is registered globally in `main.ts`** and therefore absent from a testing module built from `AppModule` alone.

Keep at least one test per module that compiles it with no overrides at all.

## The bootstrap gap

The harness (`Test.createTestingModule(...).createNestApplication()`) **never executes `main.ts`**. Everything applied there — security headers, body limits, CORS, global pipes registered imperatively — is silently absent from every end-to-end test, so the suite validates an application that is not the one you deploy.

```ts
// main.ts
export function configurePlatform(app: INestApplication, opts?: PlatformOptions) { … }

// x.e2e-spec.ts
const app = moduleRef.createNestApplication({ bodyParser: false });
configurePlatform(app, { bodyParser: false });
await app.init();
```

Note the `bodyParser: false`: Nest auto-registers a body parser with a default size limit unless you pass it, and a second parser registered afterwards **never sees an oversized body** — the first one already rejected it. A body-limit test that passes for that reason is testing the default, not your configuration.

## Fixtures, constructors and blast radius

Adding a constructor parameter, or a required column to a widely-fixtured entity, breaks specs that have nothing to do with the change and that no plan lists — because integration specs hand-construct services (`new OrdersService(...)`) and build entity literals in local `buildUser()` helpers.

- Before calling a constructor change safe, grep the **whole package** for `new <ServiceName>(`.
- Before adding a required field to a common entity, grep for the fixture factories that build it.
- **`ts-jest` does not structurally check object literals**, so Jest can stay green while `tsc --noEmit` fails. A task that runs only its own tests will report success. Run the typecheck.
- Where the new collaborator is optional at construction, use a trailing TypeScript-optional parameter *without* `@Optional()` — Nest still injects and still fails loudly at boot, while positional call sites keep compiling ([dependency-injection.md](dependency-injection.md)).

The same blast radius applies to signed-token claim shapes: adding a required claim breaks every spec that hand-signs a token, and no constructor grep finds those. Grep for the signing call too.

## Cross-suite leakage

End-to-end lanes typically run in band — every spec file boots its own application **in the same process**. Two consequences:

- **Env-gated configuration is read once per boot.** A spec that sets `FEATURE_X=true` before its own testing module and never restores it flips that feature on for every application booted afterwards. It surfaces as unrelated suites failing — or worse, passing — depending on file order. Snapshot the original values in module scope and restore them in `afterAll`, deleting keys that were originally undefined rather than setting them to `undefined`.
- **In-memory state is per boot, not per test.** Rate-limit storage is the usual one: each booted application gets its own, so a throttled route's budget is per spec file. A file that exceeds it gets a `429` that reads as a wrong-status assertion failure. Budget the calls and reuse one fixture account across assertions in the file.

## Database-backed tests

- **A mocked query result proves nothing about the real result shape.** A repository spec that hand-builds what the driver returns locks in whatever shape its author assumed — including a wrong one. Only a database-backed test can pin a driver's actual return shape. This is not hypothetical; see the raw-query result shapes in `engineering-paved-path:typeorm-patterns`.
- **Assert deltas, not absolute values, for global aggregates.** A shared test database keeps its rows between runs, so a test asserting an absolute `SUM(...)` across all users passes on a fresh stack and fails on the second run — seeded by its own previous execution. Per-user assertions never hit this because each run seeds fresh ids. Capture a baseline before seeding and assert `before + expected`.
- **Reproduce the CI database state before trusting a fixture.** If CI creates its database fresh and runs migrations only, a fixture that relies on seeded catalog data passes locally and fails in CI. Migrate a scratch database without seeding and point the suite at it.
- **A near-threshold test cascades.** A test that takes 80% of the runner's default timeout will exceed it on a slow machine, and because the timed-out promise is not cancelled, its work keeps running underneath every later test. Raise the suite timeout deliberately rather than reading the cascade as a regression.

## Spying and counting queries

Where the ORM caches one repository instance per entity, spying on that instance intercepts the production code path — a cheap N+1 regression test with no custom logger:

```ts
const spy = jest.spyOn(dataSource.getRepository(Item), 'find');
```

Assert **flatness** — the same count as the fixture size doubles — never a hardcoded literal. The spy intercepts every `find()` on that repository, so two unrelated queries sharing an entity both count, and the meaningful criterion is "does not scale with N", not "is exactly 1".

## Fake clocks

When a component opens on several independent time conditions, jumping a fake clock straight to the interesting moment trips whichever coarse condition fires first — the test goes green on a different code path than the one it names. Step the clock through the window, and assert on the **reason** the component returned, not merely that it returned.

## Checklist

- [ ] At least one test compiles each module with no overrides.
- [ ] The end-to-end harness applies the same platform configuration as `main.ts`.
- [ ] `await app.close()` in `afterAll`.
- [ ] Env mutations are restored symmetrically.
- [ ] Result shapes that come from a driver are pinned by a database-backed test, not a mock.
- [ ] `tsc --noEmit` runs, not just the test command.

For React component testing see `engineering-paved-path:react-testing-library`.
