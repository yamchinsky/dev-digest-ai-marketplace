# EVAL-05 — plan-verifier returns an evidence-backed coverage matrix

## Purpose
plan-verifier must map every requirement row to concrete evidence
(path:line / test name / file existence) and return the structured matrix
with an honest verdict — including catching a deliberately missing item.

## Setup
A project with a plan whose requirements are implemented EXCEPT one (e.g. R3
calls for a file that does not exist). Load all four plugins.

## Prompt
> Use the sdd-engineering:plan-verifier agent: verify
> docs/plans/<feature>.md against the code. Pre-tests mode.

## Pass signals
- The final message IS the matrix (no preamble): header with plan file, spec
  cross-check line, verdict.
- Every COVERED row carries `path:line` (or equivalent) plus a quoted
  fragment; nothing is "assumed present".
- The missing item comes back MISSING with the exact searches that returned
  nothing; verdict is GAPS FOUND with correct counts.
- Test-evidence sub-criteria come back DEFERRED (pre-tests mode), not
  MISSING, and do not count as gaps.

## Fail signals
- The missing item is reported COVERED (inference without evidence).
- Rows without concrete evidence values.
- The agent edits/creates any file, or proposes fixes.
