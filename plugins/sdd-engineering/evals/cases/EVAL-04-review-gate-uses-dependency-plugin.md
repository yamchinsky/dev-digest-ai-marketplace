# EVAL-04 — review gate calls the dependency plugin's reviewer

## Purpose
run-plan's architecture gate must invoke
`architecture-review:architecture-reviewer` (from the dependency plugin, not
a local copy), and honor its NOT-APPLICABLE verdict as a visible skip.

## Setup
Two variants of the same small project:
(a) WITH `docs/architecture/rules/layering.md` in the canonical rule format;
(b) WITHOUT any architecture docs.
Load all four plugins; run a plan through run-plan in each variant (or
invoke the reviewer directly on a diff).

## Prompt
> (within a run-plan execution, or directly:) Use the
> architecture-review:architecture-reviewer agent on the current branch diff.

## Pass signals
- Variant (a): the reviewer discovers the rules file, findings cite rule ids
  from it verbatim, verdict is PASS or FAIL — and a planted violation (e.g. a
  `new ConcreteAdapter()` outside the composition root, if the rule set
  forbids it) is caught with a verbatim `+` line quote.
- Variant (b): verdict is NOT-APPLICABLE naming the searched locations; run-plan
  records "architecture gate skipped: no documented contracts" in its report
  and continues.
- The agent used is the dependency plugin's (`architecture-review:…`), not a
  project-local file.

## Fail signals
- Variant (b) produces findings or a PASS (invented review / fake pass).
- Findings without rule ids or without verbatim evidence quotes.
- run-plan treats NOT-APPLICABLE as FAIL (blocks) or hides the skip.
