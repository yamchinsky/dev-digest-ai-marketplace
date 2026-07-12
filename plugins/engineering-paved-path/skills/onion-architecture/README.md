# Onion Architecture skill

A Claude Code skill providing **layering and dependency-rule conventions** for
TypeScript backends built on Fastify + Drizzle, with an optional pure engine
package for domain computation.

## Version

**1.0.0** — generalized release for the `engineering-paved-path` plugin.

## Focus

This skill answers two questions for backend code:

1. **Where does this file live?** — route vs service vs repository vs adapter vs platform vs shared contract vs engine-internal.
2. **Which way may dependencies point?** — the Dependency Rule applied to concrete file paths and package boundaries.

It codifies a working pattern (feature-modular outside, onion-layered inside) — it does **not** mandate a refactor toward classical `domain/application/infrastructure/presentation` rings, and it does **not** push a DI framework.

**In scope:**
- The four-ring model (domain core / application / infrastructure / presentation) mapped to concrete paths
- The non-negotiable `routes.ts` / `service.ts` / `repository.ts` triple inside each `modules/<name>/`
- Ports & adapters: when to add a port, where the interface lives (shared contracts package), where the concrete adapter lives, how it's wired in the `Container`, how it's mocked
- Zod three-way split (transport DTO vs domain invariant vs adapter decoder)
- Pure-engine purity invariants (no fs, no env, no DB, no HTTP framework; outbound only via injected ports)
- DI via a single composition root; explicit rejection of decorator-DI inside the engine
- Cross-package boundary rules (explicit aliases, single consumption mode, ESM suffix consistency)
- Testing-tier mapping to a hermetic-vs-infrastructure filename convention
- Escape hatch for true CRUD where Onion is overkill
- Common pitfall catalog

**Out of scope:**
- Fastify runtime patterns — request lifecycle, hooks, plugins, serialization (see `engineering-paved-path:fastify-best-practices`)
- Drizzle query syntax, schema definition, migrations (see `engineering-paved-path:drizzle-orm-patterns`, `engineering-paved-path:postgresql-table-design`)
- Zod schema mechanics — `safeParse`, refinements, `z.infer` (see `engineering-paved-path:zod`)
- Frontend organization (see `engineering-paved-path:frontend-architecture`)
- Type-level programming (see `engineering-paved-path:typescript-expert`)
- Security review (see `engineering-paved-path:security`)

## When this skill triggers

Phrases that should activate it (matched against the skill description):

- "where should I put X" / "where does this go" (backend context)
- "add a new module" / "new endpoint" / "new repository" / "new adapter"
- "wire up a port" / "register a service"
- "consume X from a service"
- "the engine needs to read [a file / env var / DB]"
- "service is doing too much"
- "should this be in the route or the service"
- "ORM in a service" / "SDK in a route" / layering violations
- Backend code edits in a layered Fastify + Drizzle project

## Use cases

1. Adding a new feature module from scratch
2. Adding a new outbound integration (DB, HTTP, LLM, third-party API, fs)
3. Deciding the placement of a single new file in the backend
4. Reviewing a backend PR for layer violations
5. Extending a pure engine package without breaking its purity
6. Settling a "should this be a service or a route" debate

## Relationship to other skills (no overlap)

| Skill | Focus | This skill differs by |
|---|---|---|
| `engineering-paved-path:fastify-best-practices` | Fastify lifecycle, plugins, hooks, schema validation **mechanics**, error handling **mechanics** | **No** Fastify runtime patterns; only where the route file lives and what it may import |
| `engineering-paved-path:drizzle-orm-patterns` | Drizzle query syntax, schema, relations, transactions, migrations | **No** query syntax; only where the Drizzle import is allowed |
| `engineering-paved-path:postgresql-table-design` | Postgres schema design, indexing, constraints | Not schema design |
| `engineering-paved-path:zod` | Zod schema mechanics: `safeParse`, refinements, error handling | **No** Zod syntax; only which **purpose** of schema goes **where** |
| `engineering-paved-path:typescript-expert` | Type-level programming, monorepo management | Not types |
| `engineering-paved-path:frontend-architecture` | Same questions for the client side | This skill is the backend mirror |

If a question is purely about structure, this skill is primary. If it's a mix (e.g. "where do I put a new LLM-calling endpoint and how do I cache prompts"), multiple skills may load — `onion-architecture` answers *where* (port in `adapters/llm/`, service orchestrates, route is thin); the SDK-specific skill answers *how the call is shaped*.

## Files

- `SKILL.md` — main rules with severity tags (CRITICAL / HIGH / MEDIUM). Loaded when the skill triggers.
- `examples.md` — concrete code skeletons (new module, new port, extending the engine purely). Loaded on demand.
- `README.md` — this file: meta, version, sources, scope boundaries. Not loaded into Claude's context; reference for humans maintaining the skill.

## Maintenance

When updating the skill:
- Bump the `version` field in `SKILL.md` frontmatter and the **Version** section above.
- Add a row to **Version history**.
- Add any new sources used to the **Sources** section, preserving URL verbatim.
- If a consuming repository documents conventions that diverge from the skill, the repository's own architecture docs win for that repository — this skill provides the default, not an override.

---

## Sources

All sources used to derive the rules in `SKILL.md`. URLs preserved verbatim.

### Onion Architecture — canonical

- [The Onion Architecture: Part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) — Jeffrey Palermo, 2008. Origin of the term; the four-ring diagram.
- [The Onion Architecture: Part 2](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/) — Palermo, 2008. Layer responsibilities.
- [The Onion Architecture: Part 3](https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/) — Palermo, 2008. The four tenets, including "all application core code can be compiled and run separate from infrastructure" — the rule that justifies the pure-engine purity invariants.
- [DDD, Hexagonal, Onion, Clean, CQRS, … How I put it all together — Herberto Graça, 2017](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/) — the most-cited modern synthesis ("Explicit Architecture") showing how Onion overlaps with Hex (Ports & Adapters) and Clean.
- [Hexagonal vs Onion vs Clean — buarki on DEV](https://dev.to/buarki/hexagonal-vs-onion-vs-clean-architecture-1ld7) — practical TS-flavored comparison.

### Domain modeling & anti-patterns

- [AnemicDomainModel — Martin Fowler](https://martinfowler.com/bliki/AnemicDomainModel.html) — why bare types + all-logic-in-services is an anti-pattern, and when it's tolerable.
- [Clean Node.js Architecture — Khalil Stemmler](https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/) — pragmatic TS take; the "where does this logic go" decision tree behind §4 of `SKILL.md`.

### Fastify & DI in TypeScript

- [`@fastify/awilix`](https://github.com/fastify/fastify-awilix) — official awilix integration; the path to take if/when request-scoped DI becomes necessary. This skill recommends a manual composition root until then.
- [marcoturi/fastify-boilerplate](https://github.com/marcoturi/fastify-boilerplate) — Fastify 5 vertical-slice-onion+CQRS reference, with `dependency-cruiser` boundary enforcement. Inspiration for the structural anti-patterns in §11.
- [revell29/fastify-clean-architecture](https://github.com/revell29/fastify-clean-architecture) — horizontal four-ring split. Considered and rejected in favor of codifying the vertical feature-module pattern.
- [borjatur/clean-architecture-fastify-mongodb](https://github.com/borjatur/clean-architecture-fastify-mongodb) — minimal `core/` vs `infrastructure/` reference.

### Conflicting opinions / open questions

(Material for future skill iterations.)

- **Vertical slices vs horizontal rings** — marcoturi/fastify-boilerplate stacks vertical slices over an onion core; revell29/fastify-clean-architecture is purely horizontal. This skill codifies the vertical (`modules/<name>/`) variant.
- **DI framework or not** — awilix gives request-scoped DI; manual composition is simpler and greppable. Skill keeps the manual approach until there's a concrete request-scoped need.
- **Where domain Zod lives** — could be in the engine package (closer to the computation) or in the shared contracts package (consumed by all). The skill recommends the shared contracts package.
- **One repository class vs split per aggregate** — the skill leaves it as a threshold judgment (composed when >1 aggregate).

---

## Version history

- **1.0.0** — generalized for the `engineering-paved-path` plugin: repository-specific paths and package names replaced with generic equivalents; repository-local convention references removed. Extracted and generalized from the DevDigest engineering harness.
- **0.1.0 (2026-06-20)** — initial release. Sourced from Palermo's 2008 Onion Architecture series, Herberto Graça's 2017 "Explicit Architecture" synthesis, Fowler's `AnemicDomainModel`, Khalil Stemmler's clean-Node materials, the `@fastify/awilix` docs, and the marcoturi/revell29/borjatur Fastify references.
