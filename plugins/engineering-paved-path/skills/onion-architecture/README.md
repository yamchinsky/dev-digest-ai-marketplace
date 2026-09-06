# Onion Architecture skill

A Claude Code skill providing **layering and dependency-rule conventions** for
TypeScript backends, with an optional pure engine package for domain
computation.

## Version

**1.1.0** — stack-neutral rewrite. Rules are stated in framework-neutral terms;
the concrete examples are NestJS + TypeORM.

## Focus

This skill answers two questions for backend code:

1. **Where does this file live?** — HTTP edge vs service vs repository vs adapter vs platform vs shared contract vs engine-internal.
2. **Which way may dependencies point?** — the Dependency Rule applied to concrete file paths and package boundaries.

It codifies a working pattern (feature-modular outside, onion-layered inside) — it does **not** mandate a refactor toward classical `domain/application/infrastructure/presentation` rings.

**In scope:**
- The four-ring model (domain core / application / infrastructure / presentation) mapped to concrete paths
- A vocabulary table mapping the neutral terms onto NestJS + TypeORM and onto a framework-less setup
- The non-negotiable edge / service / repository triple inside each `modules/<name>/`
- Ports & adapters: when to add a port, where the interface and its DI token live, where the concrete adapter lives, why the factory owns the safety checks, how it is mocked
- The three-way schema split (transport DTO vs domain invariant vs persistence shape)
- Pure-engine purity invariants (no fs, no env, no DB, no HTTP framework, no DI container; outbound only via injected ports)
- One composition root — using the framework's DI where the framework has one, manual composition where it does not
- Cross-package boundary rules (explicit aliases, single consumption mode, ESM suffix consistency)
- Testing-tier mapping to a hermetic-vs-infrastructure filename convention
- Escape hatch for true CRUD where Onion is overkill
- Common pitfall catalog

**Out of scope:**
- NestJS runtime and wiring mechanics — modules, providers, enhancers, validation pipes, testing modules (see `engineering-paved-path:nestjs-best-practices`)
- ORM query syntax, entity definition, migrations, transactions, soft deletes (see `engineering-paved-path:typeorm-patterns`)
- PostgreSQL schema design (see `engineering-paved-path:postgresql-table-design`)
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
- "should this be in the controller or the service"
- "ORM in a service" / "SDK in a controller" / layering violations
- Backend code edits in a layered TypeScript project

## Use cases

1. Adding a new feature module from scratch
2. Adding a new outbound integration (DB, HTTP, LLM, third-party API, fs)
3. Deciding the placement of a single new file in the backend
4. Reviewing a backend PR for layer violations
5. Extending a pure engine package without breaking its purity
6. Settling a "should this be a service or a controller" debate

## Relationship to other skills (no overlap)

| Skill | Focus | This skill differs by |
|---|---|---|
| `engineering-paved-path:nestjs-best-practices` | Framework wiring, DI mechanics, request pipeline, validation, testing lanes | **No** runtime mechanics; only where a file lives and what it may import |
| `engineering-paved-path:typeorm-patterns` | Entities, queries, migrations, transactions, soft deletes | **No** query syntax; only where the ORM import is allowed |
| `engineering-paved-path:postgresql-table-design` | Postgres schema design, indexing, constraints | Not schema design |
| `engineering-paved-path:zod` | Zod schema mechanics: `safeParse`, refinements, error handling | **No** schema syntax; only which **purpose** of schema goes **where** |
| `engineering-paved-path:typescript-expert` | Type-level programming, monorepo management | Not types |
| `engineering-paved-path:frontend-architecture` | Same questions for the client side | This skill is the backend mirror |

If a question is purely about structure, this skill is primary. If it's a mix (e.g. "where do I put a new LLM-calling endpoint and how do I wire the provider"), multiple skills may load — `onion-architecture` answers *where* (port in `adapters/llm/`, service orchestrates, edge is thin); the framework skill answers *how it is registered and injected*.

## Files

- `SKILL.md` — main rules with severity tags (CRITICAL / HIGH / MEDIUM). Loaded when the skill triggers.
- `examples.md` — concrete code skeletons in NestJS + TypeORM (new module, new port, extending the engine purely). Loaded on demand.
- `README.md` — this file: meta, version, sources, scope boundaries. Not loaded into Claude's context; reference for humans maintaining the skill.

## Maintenance

When updating the skill:
- Bump the `version` field in `SKILL.md` frontmatter and the **Version** section above.
- Add a row to **Version history**.
- Add any new sources used to the **Sources** section, preserving URL verbatim.
- **Keep the prose framework-neutral.** Concrete stack names belong in the vocabulary table and in `examples.md`, not in the rules — that separation is what lets the skill serve a repository whose stack differs.
- Keep the sibling cross-references pointing at skills that actually exist in this plugin, all plugin-namespaced.
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

### Framework DI (added for 1.1.0)

- [NestJS — Modules](https://docs.nestjs.com/modules) — the composition-root model, `exports` as the module's public surface, the `@Global()` guidance.
- [NestJS — Custom providers](https://docs.nestjs.com/fundamentals/custom-providers) — `useClass` / `useValue` / `useFactory` / `useExisting`, and when an explicit token is required. Basis for the "bind through the factory" rule in §3 and for §7's position that framework DI is the composition root where the framework provides one.
- [NestJS — Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes) — why the default singleton scope is the one that keeps the graph reviewable.

### Historical sources for 1.0.0

Retained as provenance: the 1.0.0 rules were derived while the skill's examples
targeted a different runtime. The structural conclusions survived the rewrite;
the citations are kept so the derivation stays auditable.

- [`@fastify/awilix`](https://github.com/fastify/fastify-awilix) — an official framework/DI-container integration; the reference point for "reach for a container when request-scoped DI becomes necessary", which 1.1.0 generalised into §7.
- [marcoturi/fastify-boilerplate](https://github.com/marcoturi/fastify-boilerplate) — vertical-slice-onion + CQRS reference with `dependency-cruiser` boundary enforcement. Inspiration for the structural anti-patterns in §11.
- [revell29/fastify-clean-architecture](https://github.com/revell29/fastify-clean-architecture) — horizontal four-ring split. Considered and rejected in favour of codifying the vertical feature-module pattern.
- [borjatur/clean-architecture-fastify-mongodb](https://github.com/borjatur/clean-architecture-fastify-mongodb) — minimal `core/` vs `infrastructure/` reference.

### Conflicting opinions / open questions

(Material for future skill iterations.)

- **Vertical slices vs horizontal rings** — the references above split on this; this skill codifies the vertical (`modules/<name>/`) variant.
- **DI framework or not** — settled differently by 1.1.0 than by 1.0.0: where the framework ships a container, use it; where it does not, manual composition is simpler and greppable. The engine package stays container-free either way.
- **Where domain schemas live** — could be in the engine package (closer to the computation) or in the shared contracts package (consumed by all). The skill recommends the shared contracts package.
- **One repository class vs split per aggregate** — the skill leaves it as a threshold judgment (composed when >1 aggregate).
- **Module-local vs shared ports** — a port used by one module can live in that module's `ports/`; the skill recommends the shared contracts package once a second consumer appears, but the migration point is a judgment call.

---

## Version history

- **1.1.0 (2026-09-06)** — stack-neutral rewrite. The description and all rule prose no longer name a specific HTTP framework or ORM; a vocabulary table maps the neutral terms onto NestJS + TypeORM and onto a framework-less setup; `examples.md` rewritten in NestJS + TypeORM. §7 reframed: the previous blanket rejection of decorator-based DI became "use the framework's container where the framework provides one; manual composition where it does not; the pure engine package stays container-free either way". New rules absorbed from the runtime skills: bind a port through its factory rather than the concrete class, repositories never read configuration, and a hermetic test proves logic while only a real module compile proves wiring. Sibling cross-references now point at `engineering-paved-path:nestjs-best-practices` and `engineering-paved-path:typeorm-patterns`.
- **1.0.0** — generalized for the `engineering-paved-path` plugin: repository-specific paths and package names replaced with generic equivalents; repository-local convention references removed. Extracted and generalized from the DevDigest engineering harness.
- **0.1.0 (2026-06-20)** — initial release. Sourced from Palermo's 2008 Onion Architecture series, Herberto Graça's 2017 "Explicit Architecture" synthesis, Fowler's `AnemicDomainModel`, Khalil Stemmler's clean-Node materials, and the framework/DI references listed above.
