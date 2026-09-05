# HANDOFF — wrong-stack skills in `engineering-paved-path`

A work order for a fresh session. Everything needed to start is in this file;
no verbal context required. Delete this file in the PR that completes the work.

**Read first:** [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md). They own naming,
layout, dependency, CHANGELOG and release rules. This file does not restate
them — it states what to build and the constraints that are not obvious from
reading the repository.

---

## 1. Why this exists

`trenya` (NestJS 10 + TypeORM + PostgreSQL, Expo mobile, Next.js web) installs
this marketplace. On 2026-09-06 it was found that its SDD pipeline had been
inert for three weeks: `engineering-paved-path` was disabled project-locally,
and because `sdd-engineering` and `architecture-review` both declare it in
`dependencies`, **both silently failed to load** — no warning, while still
reading `true` in `enabledPlugins`. `run-plan`, the `plan-verifier` coverage
gate and the architecture gate were all unavailable while every document in
that repo described them as active.

It was disabled for one reason: three of the twelve skills teach a stack that
repository does not use, and a wrong-stack skill selected by name is worse than
no skill. That was fixed downstream (trenya PR #120) by re-enabling the plugin
and adding a never-select rule for those three skills. **That rule is a
workaround. This handoff is the real fix.**

## 2. The three skills

| Skill | Size | Teaches | Why it misleads a NestJS+TypeORM consumer |
|---|---|---|---|
| `fastify-best-practices` | `SKILL.md` + 19 `rules/*.md` + `tile.json` | Fastify plugins, hooks, JSON-Schema validation, serialization, Pino | Nest has none of these primitives. Its equivalents are modules/providers, interceptors/guards/pipes, `class-validator` DTOs, and a different lifecycle entirely. |
| `drizzle-orm-patterns` | `SKILL.md` + 9 `references/*.md` | Drizzle schema builders, query syntax, migrations, transactions | TypeORM is entity/decorator-based with its own migration model, `DataSource.query()` semantics, and soft-delete behaviour. Almost nothing transfers. |
| `onion-architecture` | `SKILL.md` (365 lines) + `examples.md` + `README.md` | Layering and the dependency rule | The layering *substance* is sound and largely stack-neutral. The framing is not: its own description says "(Fastify + Drizzle)", it names those two skills as its siblings, and it states it "does not introduce a DI framework" — which is backwards for Nest, where DI *is* the framework and the composition root is `app.module.ts`. 23 Fastify/Drizzle mentions in `SKILL.md`, 9 in `examples.md`, 13 in `README.md`. |

## 3. The constraint that decides the shape of the fix

**Do not rewrite these three in place without an owner decision.** DevDigest —
the harness these skills were extracted from, and the marketplace's primary
consumer — runs Fastify and Drizzle itself (`server/package.json`:
`fastify`, `@fastify/autoload`, `@fastify/cors`, `@fastify/helmet`,
`@fastify/rate-limit`, `fastify-sse-v2`, `fastify-type-provider-zod`,
`drizzle-orm`, `drizzle-kit`). For that repository the three skills are
correct. Rewriting them for NestJS would fix one consumer by breaking the
other, and would be a breaking change requiring a major bump.

Note also that `fastify-best-practices` carries upstream provenance in its
`tile.json` (`"name": "mcollina/fastify-best-practices"`). It is a vendored
third-party skill, not original work — "rewriting" it into a Nest skill would
mean inventing new content under someone else's lineage. Do not do that.

**Option A — add siblings (recommended).** Two new skills next to the existing
ones, plus a stack-neutral pass on `onion-architecture`. Additive, minor bump,
no consumer breaks. Both stacks are then served, and a consumer picks by name.

**Option B — replace.** Only if a code owner confirms DevDigest no longer needs
the Fastify/Drizzle skills. Breaking; major bump; `tile.json` provenance must
be dropped rather than repurposed.

Proceed with Option A unless a code owner says otherwise in the issue.

## 4. The task

### 4.1 Research first, write second

The point of this work is *current* accuracy, not a paraphrase of what an LLM
remembers about NestJS. Use `research-tools:researcher` and the web. Establish
and cite, at minimum:

- the current major of NestJS, TypeORM and `pg`, and which pairings are
  actually supported together;
- what changed recently enough that pre-existing training data is likely wrong
  (deprecations, renamed lifecycle APIs, ESM/CJS status, decorator-metadata
  requirements under current TypeScript);
- TypeORM's own documented positions on migrations vs `synchronize`,
  `DataSource.query()` result shapes, soft deletes and `QueryBuilder`
  behaviour, repository vs entity-manager usage, transaction handling;
- PostgreSQL-side practice that the ORM does not do for you (indexing,
  constraints, enum handling, connection pooling) — and cross-reference
  `postgresql-table-design`, which already covers table design and must not
  be duplicated.

Prefer primary sources (official docs, release notes, changelogs, maintainer
issues). Record every source URL in the new skills' `README.md`, matching how
`onion-architecture/README.md` records sources and version history today.

### 4.2 Author the skills

Create, under `plugins/engineering-paved-path/skills/`:

- **`nestjs-best-practices`** — modules and providers, DI and injection tokens,
  the composition root, controllers as thin edges, guards/interceptors/pipes/
  filters, `class-validator`/`class-transformer` DTO validation at the edge,
  configuration and `ConfigModule`, testing with `Test.createTestingModule`,
  lifecycle hooks, exception handling.
- **`typeorm-patterns`** — entity and relation definition, `DataSource`
  configuration, repository patterns, `QueryBuilder` vs `find` semantics,
  raw-SQL escape hatches and their result shapes, hand-written migration
  discipline, transactions, soft deletes, indexing and constraints at the
  entity boundary.

Mirror the existing structure exactly. `drizzle-orm-patterns` is the closest
model for `typeorm-patterns` (a `SKILL.md` plus a `references/` directory);
`fastify-best-practices` is the closest model for `nestjs-best-practices`
(a `SKILL.md` plus a `rules/` directory of one-topic files). **Do not create a
`tile.json`** — that file exists only to record upstream provenance for a
vendored skill, and these are original work.

### 4.3 `onion-architecture`

Make it stack-neutral rather than forking it. Concretely: move Fastify/Drizzle
out of the description and prose into clearly-labelled examples, add the Nest
mapping alongside (module = feature module, composition root = `app.module.ts`,
repository = TypeORM repository behind the module's own repository class), and
fix the "does not introduce a DI framework" clause so it reads as "framework DI
is fine where the framework provides it" instead of an implicit prohibition.
Keep the sibling cross-references accurate: they must name whichever runtime
and ORM skills exist after this change, all plugin-namespaced.

### 4.4 Wiring and metadata

- `plugins/engineering-paved-path/.claude-plugin/plugin.json`: minor version
  bump, description count ("Twelve shared…") updated, keywords extended with
  `nestjs` and `typeorm`.
- `plugins/engineering-paved-path/README.md` and the root `README.md` plugin
  table: both state the skill count and list; both are now wrong.
- `plugins/engineering-paved-path/CHANGELOG.md`: entries under
  `## [Unreleased]`, describing behaviour, not file names.
- Check whether `sdd-engineering` should route to the new skills. Its
  `implementation-planner`, `implementer` and `plan-verifier` agents name
  `engineering-paved-path:*` skills explicitly — a NestJS consumer's plan
  should be able to reach the Nest skills the same way a Fastify consumer's
  reaches the Fastify ones. If those agent files change, that plugin needs its
  own CHANGELOG entry and version bump.

### 4.5 Style rules to preserve

These are what make a skill in this repository feel like the others:

- Frontmatter: `name` (kebab-case, matching the directory), a `description`
  that is one long paragraph ending with explicit trigger terms, and the
  negative-scope clause the existing skills use ("… ONLY — NOT X (use
  `plugin:other-skill`)"). That clause is what stops two skills competing for
  the same activation.
- Cross-references always plugin-namespaced (`engineering-paved-path:zod`),
  never bare, never relative paths into another plugin.
- No absolute paths, no repository-specific assumptions, no secrets, no network
  calls in supporting scripts. Files shipped with the skill are addressed via
  `${CLAUDE_SKILL_DIR}`.
- English throughout — content, docs, commits, PR body.
- An "Inputs" section that says what the skill assumes about the caller's
  repository, and that the caller's own documented rules take precedence.
  `onion-architecture` has the canonical wording.
- Prose that states the trap and the reason, not just the rule. The existing
  skills are terse and evidence-led; match that register.

## 5. Definition of done

- [ ] `claude plugin validate ./plugins/engineering-paved-path --strict` passes
- [ ] `claude plugin validate . --strict` passes
- [ ] The plugin loaded with `claude --plugin-dir` in a real NestJS repository,
      and the new skills activate on realistic prompts while the Fastify and
      Drizzle ones do **not** — false activation is the failure mode that
      caused this handoff, so test it explicitly. `sdd-engineering`'s
      `evals/cases/EVAL-07-namespacing-and-no-false-activation.md` is the
      existing precedent for how to phrase that check.
- [ ] CHANGELOGs updated for every plugin touched; versions bumped
- [ ] Both README skill lists correct
- [ ] PR body uses the checklist in `CONTRIBUTING.md`
- [ ] This file deleted

## 6. Downstream follow-up (different repository, do not do it here)

Once released, `trenya` should drop its never-select workaround and point at
the new skills instead. Two places name the three skills explicitly:
`AGENTS.md` (Non-obvious globals) and `docs/sdd-conventions.md` §(e). Its root
`INSIGHTS.md` also carries the dated entry explaining the dependency-chain
outage; leave that as history.

## 7. Separate, independent problem worth an issue

`architecture-review` declares `engineering-paved-path@^1.0.0` as a hard
dependency, but uses it in exactly one optional place: the reviewer *may* load
`engineering-paved-path:onion-architecture` to interpret layering rules
(`agents/architecture-reviewer.md:49`, `README.md:43-44`). A hard dependency
for an optional enrichment is what turned a deliberate consumer choice into a
silent outage of an unrelated gate.

`sdd-engineering`'s dependency is by contrast genuine — its planner,
implementer and verifier agents name specific `engineering-paved-path:` skills
throughout.

Worth deciding: should an optional-enrichment reference be expressible without
a hard dependency, and should a plugin whose dependency is disabled fail
loudly rather than vanish? At minimum, document the behaviour in
`docs/PLUGIN-GUIDELINES.md` — nothing in this repository currently warns that
disabling a plugin disables its dependents.
