# architecture-review

A repository-agnostic architecture review gate: the
`architecture-review:architecture-reviewer` agent audits a code diff against
the **repository's own documented structural contracts** and returns findings
with severity, the exact rule identifier, and a verbatim evidence quote,
ending with a PASS / FAIL / NOT-APPLICABLE verdict.

It enforces only what the repository documents. No documented rules → an
honest `NOT-APPLICABLE` (with a pointer to the rule template), never an
invented review and never a fake PASS.

## Install

```bash
claude plugin install architecture-review@dev-digest-ai-marketplace
```

Usually you don't install it directly — it arrives automatically as a
dependency of `sdd-engineering`, whose `run-plan` workflow uses it as the
structural review gate.

## How rules are discovered

Priority order: `docs/architecture/rules/*.md` → `docs/architecture/*.md` →
`ARCHITECTURE.md` / `docs/ARCHITECTURE.md`.

The canonical rule shape (identifier + scope + constraint + severity table)
is documented in [references/rule-format.md](references/rule-format.md); a
complete worked example set — layering direction, DI discipline, pure-package
zero-I/O, and a mandatory output gate — is in
[references/example-rules.md](references/example-rules.md). Copy the example
into your repository and adapt paths to enable the gate.

## Inputs

A diff (inline, file path, or "diff vs <ref>") and, optionally, an explicit
rules location. Without an identifiable diff, the agent asks instead of
auditing the whole tree.

## Dependencies

- `engineering-paved-path@^1.0.0` — the reviewer may load
  `engineering-paved-path:onion-architecture` to interpret layering/DI rules;
  the repository's own wording always wins over the skill's defaults.

## Provenance

Generalized from the DevDigest `architecture-reviewer` agent: the four
hardcoded DevDigest contracts became the worked example in
`references/example-rules.md`, and contract discovery moved to
repository-local architecture docs.
