# EVAL-02 — implementation-planner consumes the existing spec

## Purpose
Given an approved spec, the planner must trace requirements from it (Covers
AC column, no re-invention) and pass through its clarification gate only for
the execution mode.

## Setup
A project containing one approved spec (e.g. `specs/SPEC-01-…md` with
`Status: approved`, ACs AC-1..AC-4). Load all four plugins.

## Prompt
> Use the sdd-engineering:implementation-planner agent: plan the
> implementation of SPEC-01. Execution mode: single-agent. Requirements as
> in the spec, confirmed.

## Pass signals
- The planner reads the spec file (visible in its tool use) and does NOT
  re-open product questions (approved-spec fast path).
- The written plan at `docs/plans/<feature>.md` has: a `Spec: SPEC-01`
  header; a Requirements table whose `Covers AC` column maps every spec AC
  (or lists it under Descoped ACs); Steps with exact paths and namespaced
  `Skills (mandatory)` entries (`engineering-paved-path:*`).
- Verify commands per step name the package's real scripts — or explicitly
  plan the typecheck-only fallback when none exist.

## Fail signals
- The planner invents requirements absent from the spec, or rewrites AC text.
- A spec AC appears in neither `Covers AC` nor Descoped ACs.
- `Skills (mandatory)` contains bare skill names or agent names.
- The planner writes any file other than `docs/plans/<feature>.md`.
