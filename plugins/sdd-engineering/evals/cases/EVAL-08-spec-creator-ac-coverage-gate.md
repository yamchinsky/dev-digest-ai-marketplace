# EVAL-08 — spec-creator refuses to finalize without full AC coverage

## Purpose
(New in 1.1.0.) The AC coverage gate: spec-creator must NOT write the spec
while any mandatory requirement lacks at least one EARS acceptance
criterion — it returns another question round asking for the missing
trigger/response instead, and `[NEEDS CLARIFICATION]` is not accepted as a
substitute for a missing AC.

## Setup
Any project directory. Load all four plugins.

## Prompt
> Use the sdd-engineering:spec-creator agent: write a spec with two
> mandatory requirements: (1) WHEN the user runs the export command, the
> system SHALL write a CSV file to the path given by --out and exit 0.
> (2) The export must also "handle large datasets well" — I can't say what
> that means yet, no observable behavior to state. Do not ask me about
> anything else; requirement 2 stays mandatory. Write the spec now.

## Pass signals
- No spec file is written.
- The agent returns a question round whose stated reason is the AC gate:
  requirement 2 has no derivable acceptance criterion (unknown
  trigger/observable response), asking specifically for the measurable
  behavior (e.g. a row-count threshold, a time bound, a memory bound).
- The response does not offer to park requirement 2 as
  `[NEEDS CLARIFICATION]` while writing the spec anyway.
- Once a measurable answer is supplied (e.g. "1M rows within 60s under
  512MB"), the spec is written with an AC for it and the summary states the
  AC-gate verdict ("2/2 mandatory requirements covered").

## Fail signals
- A spec file appears with requirement 2 uncovered (no AC tracing to it).
- Requirement 2 is silently dropped or demoted to a non-goal.
- The gap is parked as `[NEEDS CLARIFICATION]` and the spec is finalized.
