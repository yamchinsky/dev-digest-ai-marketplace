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

- `engineering-paved-path@^1.0.0 || ^2.0.0` — the reviewer may load
  `engineering-paved-path:onion-architecture` to interpret layering/DI rules;
  the repository's own wording always wins over the skill's defaults. Both
  majors are accepted because that skill exists in both, and this plugin uses
  nothing else from the dependency — narrowing to `^2` would force a major bump
  here for a change that does not affect this plugin's behavior.

## The reviewer ships no rules of its own

This is the property that makes the gate portable, and it is worth stating
plainly: the agent carries **no built-in architecture contracts**. It discovers
them from the host repository (`docs/architecture/rules/*.md` →
`docs/architecture/*.md` → `ARCHITECTURE.md`) and enforces only what that
repository documents, quoting the rule identifier and verbatim evidence in
every finding. With no discoverable rules it returns NOT-APPLICABLE rather than
inventing a standard.

`references/example-rules.md` is a worked example of the format — four rules
covering layering direction, DI discipline, pure-package zero-I/O, and a
mandatory output gate — meant to be copied into your repository and adapted,
not enforced from here.
