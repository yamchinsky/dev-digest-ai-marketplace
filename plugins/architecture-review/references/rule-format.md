# Structural rule format

The `architecture-review:architecture-reviewer` agent enforces rules your
repository documents. Put them in one of (checked in this order):

1. `docs/architecture/rules/*.md` — recommended: one file per rule family
2. `docs/architecture/*.md`
3. `ARCHITECTURE.md` (repo root or `docs/`)

## Canonical rule shape

One rule per `###`-heading whose title is the rule identifier in backticks:

```markdown
### `rule-identifier-in-kebab-case`

**Scope:** <path glob the rule applies to, e.g. `src/modules/*/domain/`>

<One paragraph stating the constraint: what is forbidden and/or what is
required. Name concrete imports, patterns, or file relationships.>

**Forbidden:** <optional list — imports/patterns that must not appear>
**Allowed:** <optional list — explicit exceptions>

| Severity | Trigger |
|----------|---------|
| CRITICAL | <what makes a violation critical — usually breaking a documented invariant> |
| HIGH     | <what makes it high — structural violation without an invariant claim> |
```

## Requirements

- **Identifier** — unique in the repository, kebab-case; findings cite it verbatim.
- **Scope** — a path or glob; the reviewer audits only changed files inside a scope.
- **Constraint** — must be checkable from the diff and file contents alone
  (imports, construction sites, call presence/absence, file placement). Rules
  requiring runtime knowledge cannot be enforced by this gate.
- **Severity table** — optional; without it the reviewer defaults to CRITICAL
  for invariant breaks, HIGH otherwise.

## Worked example

See [example-rules.md](example-rules.md) — four real rules covering layering
direction, DI discipline, package purity, and a mandatory-gate invariant.
