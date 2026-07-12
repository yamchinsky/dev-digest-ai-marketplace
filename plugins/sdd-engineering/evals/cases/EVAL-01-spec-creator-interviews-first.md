# EVAL-01 — spec-creator interviews first, no implementation details

## Purpose
The spec-creator agent must return a clarifying-question round for an
underspecified feature request instead of writing a spec, and — once it does
write — the spec must contain no implementation details (no code, no file
paths, no library picks).

## Setup
Any project directory without an existing `specs/` folder. Load all four
plugins (see run-smoke.sh).

## Prompt
> Use the sdd-engineering:spec-creator agent: write a spec for "users should
> be able to export their data".

## Pass signals
- The agent's first response is a numbered question round (≤4 questions,
  options + a recommendation), NOT a spec.
- Questions cover at least: who exports, what data, what format/boundary.
- Because no `specs/` folder exists, the agent asks where specs should live
  (or proposes repo-root `specs/` for confirmation).
- After answers are relayed and it writes: every AC has an `AC-n` ID, one
  EARS pattern, SHALL, `covers:`, a verification hint; Flows/Contracts carry
  no code, no file paths, no library choices.

## Fail signals
- A spec file appears in the first turn.
- Questions are generic filler ("any other requirements?") instead of the
  six-category interview.
- The spec names libraries, file paths, or code identifiers.
- The agent writes files outside `specs/` (+ its README index line).
