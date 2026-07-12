# Example rule set

A complete, real-world rule set in the canonical format (see
[rule-format.md](rule-format.md)). It protects a layered TypeScript backend
(`src/`) with a pure computation package (`engine/`). Copy it into
`docs/architecture/rules/` and adapt paths and names to your repository.

### `inward-only-dependencies`

**Scope:** `src/modules/*/domain/`

Domain-layer files must not import from the Presentation or Infrastructure
layers. Allowed imports: other domain types in the same module, shared
contract types. Forbidden: `fastify`, `express`, `http`, reply/response
types, adapter classes, repository classes.

| Severity | Trigger |
|----------|---------|
| CRITICAL | A domain file imports a concrete framework type and uses it as a function parameter or field type — hard coupling that makes the domain untestable without a live HTTP server |
| HIGH | A domain file imports a framework type for a purely structural reason (type annotation in a private helper, etc.) |

### `di-discipline`

**Scope:** `src/` except `src/platform/container.ts`

Concrete adapter and repository classes must be constructed (`new X()`) only
inside `src/platform/container.ts` (the composition root). Classes that
count: anything under `adapters/`, and any class whose name marks a concrete
vendor or storage implementation (e.g. `Pg*`, `Http*`, `OpenAI*`,
`Anthropic*`). A `new ConcreteClass()` in a service, domain, or module file
is a violation.

| Severity | Trigger |
|----------|---------|
| HIGH | `new <ConcreteAdapter/Repository>()` found outside `platform/container.ts` — bypasses injection and breaks testability |

### `engine-zero-io`

**Scope:** `engine/src/`

The engine is a pure computation package. It must perform zero I/O beyond
its injected ports. Forbidden in any `engine/src/` file: `import … from
'node:fs'`, `import … from 'node:path'` used for file reads, direct DB
queries, raw `fetch` or `http` calls not routed through an injected port
interface.

| Severity | Trigger |
|----------|---------|
| CRITICAL | Any I/O import added to `engine/src/` — breaks the zero-I/O contract that lets the engine run in any host environment (browser, worker, test sandbox) without side effects |

### `engine-output-gate`

**Scope:** `engine/src/`

All candidate results must pass through the engine's mandatory
post-processing gate (here: `groundFindings()`) before being returned from
any top-level export. The gate discards results that cannot be backed by
verbatim evidence. Returning results before the gate runs — or deleting its
call entirely — bypasses the invariant.

| Severity | Trigger |
|----------|---------|
| CRITICAL | The gate call removed, skipped, or short-circuited — can emit ungrounded output |
