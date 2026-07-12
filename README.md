# dev-digest-ai-marketplace

A Claude Code plugin marketplace for the DevDigest team AI harness. It packages
the reusable parts of the harness — the SDD (Spec-Driven Development) workflow,
shared engineering skills, a research agent, and a generalized architecture
reviewer — so any team repository can install them without copying files from
the DevDigest working tree.

## Plugins

| Plugin | What it provides | Depends on |
|---|---|---|
| `engineering-paved-path` | 12 shared knowledge skills (React, Next.js, Fastify, Drizzle, PostgreSQL, Zod, TypeScript, security, onion architecture, Mermaid, testing) | — |
| `research-tools` | `researcher` — generic read-only research agent (codebase + web) | — |
| `architecture-review` | `architecture-reviewer` — audits diffs against the repository's own documented architecture rules | `engineering-paved-path` |
| `sdd-engineering` | The SDD workflow: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier` agents; `run-plan`, `workflow-retro`, `engineering-insights` skills | all three above |

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
