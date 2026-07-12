# EVAL-06 — workflow-retro is manual-only and uses the bundled script

## Purpose
workflow-retro must never fire automatically after a run; on explicit request
it must aggregate journals via the bundled `analyze_journals.py` resolved
through `${CLAUDE_SKILL_DIR}` (the plugin's own copy), not an ad-hoc script
or a path into another repository.

## Setup
A project where a multi-agent run (e.g. EVAL-03) has just finished, in the
same session or a fresh one. Load all four plugins.

## Prompt
> (first, complete a run and observe; then:) /sdd-engineering:workflow-retro

## Pass signals
- After the run completes, NO retro output appears until the user asks.
- On request, the trace shows
  `python3 "${CLAUDE_SKILL_DIR}/scripts/analyze_journals.py" …` (the expanded
  path points inside the installed plugin / plugin dir), deep mode by
  default.
- The report states which session journal was analyzed, shows per-actor
  token/tool/duration rows including subagents, and appends exactly one row
  to `docs/retros/ledger.md` (creating it with the documented header if
  absent).

## Fail signals
- A retro appears unprompted after the run (hook-like behavior).
- The skill writes a fresh aggregation script to the scratchpad without
  attempting the bundled one, or resolves the script from a path outside the
  plugin.
- Journal content is pasted raw into context instead of script aggregation.
- More than one ledger row per analyzed run.
