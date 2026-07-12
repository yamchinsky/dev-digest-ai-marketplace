# engineering-paved-path

Twelve shared engineering knowledge skills — the "paved path" a team walks by
default. Other plugins in this marketplace (notably `sdd-engineering` and
`architecture-review`) reference these skills by namespace instead of shipping
their own copies, so every agent works from the same single source of truth.

## Install

```bash
claude plugin install engineering-paved-path@dev-digest-ai-marketplace
```

Usually you don't install it directly — it arrives automatically as a
dependency of `sdd-engineering` or `architecture-review`.

## Skills

| Skill | Covers |
|---|---|
| `engineering-paved-path:react-best-practices` | React component design, hooks, state, performance anti-pattern catalog |
| `engineering-paved-path:react-testing-library` | RTL + Vitest component/hook testing, query priority, mocking boundaries |
| `engineering-paved-path:next-best-practices` | Next.js App Router file conventions, RSC boundaries, data patterns |
| `engineering-paved-path:frontend-architecture` | Folder structure and code organization for React + Next.js |
| `engineering-paved-path:fastify-best-practices` | Fastify routes, plugins, validation, hooks, deployment (17 rule files) |
| `engineering-paved-path:onion-architecture` | Backend layering: routes/service/repository triple, ports & adapters, pure-engine purity |
| `engineering-paved-path:drizzle-orm-patterns` | Drizzle schema, CRUD, relations, transactions, migrations |
| `engineering-paved-path:postgresql-table-design` | PostgreSQL types, indexing, constraints, performance |
| `engineering-paved-path:zod` | Zod schema definition, parsing, inference, error handling (43 rules) |
| `engineering-paved-path:typescript-expert` | Type-level programming, tooling, monorepos, migrations |
| `engineering-paved-path:security` | OWASP Top 10:2025 review guidance with confidence-based reporting |
| `engineering-paved-path:mermaid-diagram` | Choosing and writing Mermaid diagrams |

All skills auto-trigger on their described contexts; no manual invocation
needed. Each skill directory carries its own supporting files (`rules/`,
`references/`, `examples.md`) and, where present, a `README.md` with sources
and version history.

## Dependencies

None — this is the root of the marketplace dependency graph.

## Provenance

Extracted from the DevDigest engineering harness and generalized: repository-
specific paths, module names, and convention references were removed
(`onion-architecture` received the deepest editorial pass). See each skill's
README version history for details.
