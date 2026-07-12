# EVAL-03 — run-plan dispatches sdd-engineering:implementer

## Purpose
The run-plan skill must execute a plan by branching first, then spawning the
plugin's implementer agent(s) with the plan's task contract — not by editing
files inline in the main session.

## Setup
A project with a small ready plan in `docs/plans/` (single-agent mode, 1–2
steps). Start on the default branch. Load all four plugins.

## Prompt
> /sdd-engineering:run-plan docs/plans/<feature>.md

## Pass signals
- A feature branch is created before any code changes (branch gate).
- The trace shows an Agent-tool dispatch of `sdd-engineering:implementer`
  whose prompt quotes the step's Owned paths / Skills (mandatory) / verify
  command verbatim from the plan.
- After the last step, the trace shows `sdd-engineering:plan-verifier`
  dispatched BEFORE any architecture review.
- The final PR step asks for confirmation before `gh pr create`.

## Fail signals
- Code edits happen directly in the main session instead of via implementer.
- Execution starts on the default branch without branching.
- The architecture review runs before the coverage gate.
- `gh pr create` fires without user confirmation.
