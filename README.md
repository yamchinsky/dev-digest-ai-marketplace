# dev-digest-ai-marketplace

A Claude Code plugin marketplace: the Spec-Driven Development (SDD) workflow,
shared engineering knowledge skills, a read-only research agent, and a
repository-agnostic architecture-review gate.

Every plugin here is autonomous. Nothing in it is shaped by, depends on, or is
justified by any particular consuming repository — skills describe
technologies, agents state their inputs explicitly, and review gates read the
*host* repository's own documented rules rather than carrying their own. Install
them in any repository without copying files or adopting someone else's layout.

## Plugins

| Plugin | What it provides | Depends on |
|---|---|---|
| `engineering-paved-path` | 12 shared knowledge skills (React, Next.js, NestJS, TypeORM, PostgreSQL, Zod, TypeScript, security, onion architecture, Mermaid, testing) | — |
| `research-tools` | `researcher` — generic read-only research agent (codebase + web) | — |
| `architecture-review` | `architecture-reviewer` — audits diffs against the repository's own documented architecture rules | `engineering-paved-path` |
| `sdd-engineering` | The SDD workflow: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier` agents; `run-plan`, `workflow-retro`, `engineering-insights` skills | all three above |

## What belongs here

A component ships here when it has a consumer scenario **outside** the
repository it was first written in. That test decides both directions:

| Ships here | Stays in the consuming repository |
|---|---|
| Knowledge about a technology that holds for any project using it | A repository's own module map, contracts, fixtures, and CI wiring |
| Agents and workflow skills whose inputs are stated explicitly and asked for when missing | Skills coupled to one repository's hooks, MCP servers, or directory layout |
| A review gate that reads the *host's* documented architecture rules | The rules themselves |
| Optional integrations that degrade silently when the host does not expose them | Anything that fails the workflow when a host-specific tool is absent |

The editorial standard that follows from it — no absolute paths, no
repository-specific assumptions, explicit inputs, namespaced cross-references —
is specified in [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) and
enforced on every contribution.

## How the plugins are split

The SDD workflow *is* the consumer contract: `run-plan` dispatches
`sdd-engineering:implementer` and the review gates, the planner assigns
`engineering-paved-path:*` skills to tasks, and the spec/plan formats are the
interfaces between the agents — so those components version together.
Components with an independent consumer scenario (`researcher`,
`architecture-reviewer`, the knowledge skills) live in their own plugins and
are consumed as version-constrained dependencies. `workflow-retro` has no
consumer scenario outside the SDD lifecycle, so it stays inside
`sdd-engineering` and is invoked manually only.

## Install

```bash
claude plugin marketplace add yamchinsky/dev-digest-ai-marketplace
claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project
```

Installing `sdd-engineering` automatically installs its three dependencies;
the install output lists them at the end.

## Catalog UI

A searchable static catalog is published on GitHub Pages:
<https://yamchinsky.github.io/dev-digest-ai-marketplace/>. It is generated
from the repository files (`scripts/build-index.mjs`) — never edited by hand.

## Repository layout

```
.claude-plugin/marketplace.json   # the catalog manifest
plugins/<name>/                   # one directory per plugin (source of truth)
docs/                             # guidelines, security, releases, site spec
scripts/build-index.mjs           # generates the site search index
site/                             # static catalog UI (Vite + React)
```

## Governance

- [CONTRIBUTING.md](CONTRIBUTING.md) — from proposal to merged pull request.
- [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) — naming, required
  structure, manifest fields, dependency rules.
- [docs/SECURITY.md](docs/SECURITY.md) — permissions, secrets policy, incident
  response.
- [docs/RELEASES.md](docs/RELEASES.md) — SemVer, tags, update and rollback.
- [CODEOWNERS](CODEOWNERS) — who reviews and who can release.

Plugin versions live in each plugin's `plugin.json`. A marketplace commit or
tag pins the state of the catalog; releases are immutable git tags of the form
`{plugin-name}--v{version}`.
