# sdd-engineering

The complete Spec-Driven Development (SDD) workflow as an installable plugin:
from a feature idea to a spec, from the spec to a verified plan, from the
plan to reviewed code and a pull request — with coverage and architecture
gates on the way.

```
sdd-engineering:spec-creator            → specs/SPEC-NN-*.md   (what & why)
  → sdd-engineering:implementation-planner → docs/plans/<feature>.md (how)
    → /sdd-engineering:run-plan:
        implementer waves → plan-verifier gate → architecture gate → PR
```

## Install

```bash
claude plugin marketplace add yamchinsky/dev-digest-ai-marketplace
claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project
```

The three dependencies install automatically (the install output lists them):
`engineering-paved-path` (shared knowledge skills), `research-tools`
(delegated discovery), `architecture-review` (the structural review gate).

## Components

### Agents

| Agent | Role |
|---|---|
| `sdd-engineering:spec-creator` | Writes SPEC-NN files with EARS acceptance criteria; interviews via stop-and-return question rounds; grounds facts in the repo (optional convention MCP tools → docs → code search) |
| `sdd-engineering:implementation-planner` | Turns confirmed requirements into `docs/plans/<feature>.md` with R-IDs, disjoint owned paths, namespaced per-task skills, and a dependency DAG |
| `sdd-engineering:implementer` | Executes ONE plan task in the shared tree; preloads `engineering-paved-path:typescript-expert` + `engineering-paved-path:security`; runs the package's verify command or reports "no test command found; typecheck-only" |
| `sdd-engineering:plan-verifier` | Read-only coverage gate: maps every requirement/AC to `path:line` evidence, returns ALL COVERED / GAPS FOUND |

### Skills

| Skill | Role |
|---|---|
| `/sdd-engineering:run-plan` | Executes a plan end-to-end: branch → implementer waves → coverage gate → architecture gate (honors NOT-APPLICABLE as a visible skip) → confirm → `gh pr create` |
| `/sdd-engineering:workflow-retro` | **Manual-only** post-run retrospective: aggregates session + subagent journals via the bundled `scripts/analyze_journals.py` (`${CLAUDE_SKILL_DIR}`), appends a trend row to `docs/retros/ledger.md` |
| `sdd-engineering:engineering-insights` | Appends non-obvious findings to the nearest `INSIGHTS.md` (offers to create a root one when none exists); invoked once per run by run-plan, or ad hoc |

## Where things get written

| Artifact | Location (host repository) |
|---|---|
| Specs | `specs/` at the repo root, or `<package>/specs/` when the repo uses per-package specs; spec-creator asks when neither exists |
| Plans | `docs/plans/<feature>.md` |
| Retro ledger | `docs/retros/ledger.md` (created on first retro) |
| Insights | nearest `INSIGHTS.md` (root file offered when none exists) |

## What this plugin assumes — and what it doesn't

- **No repository layout is assumed.** The planner discovers package
  topology, package managers, and conventions at runtime; repo-specific
  rules bind implementers only when the plan states them.
- **Missing test commands are handled, not fatal**: implementers fall back
  to typecheck-only and say so.
- **No hooks are shipped.** The PR step is an explicit confirm-then-create;
  host-repo hooks, if any, fire on their own.
- **Optional integrations degrade silently**: spec-creator uses repository
  convention MCP tools when the host exposes them, and falls back to docs +
  code search otherwise.

## Dependencies

- `engineering-paved-path@^1.0.0` — single source of the 12 knowledge skills
  the planner assigns and the implementer loads.
- `research-tools@^1.0.0` — `research-tools:researcher` for delegated
  discovery during planning.
- `architecture-review@^1.0.0` — the structural review gate; repositories
  document their own rules (see that plugin's `references/rule-format.md`).

## Evals

`evals/cases/EVAL-01..07` + `evals/run-smoke.sh` — behavior smoke scenarios
(interview-first spec writing, spec-consuming planning, dispatch wiring,
gate order, NOT-APPLICABLE handling, manual-only retro, namespacing, no
false activation). See `evals/README.md`.

## Compatibility

Claude Code >= 2.1.196 — see [COMPATIBILITY.md](COMPATIBILITY.md).

## Provenance

Extracted from the DevDigest engineering harness. The `run-plan` skill was
renamed from `impl`; repository-specific paths, module maps, hook couplings,
and MCP tool requirements were removed in the editorial pass — see
CHANGELOG 1.0.0.
