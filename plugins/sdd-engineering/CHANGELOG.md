# Changelog

All notable changes to `sdd-engineering` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [1.1.0] - 2026-07-12

### Added

- **spec-creator AC coverage gate** (§4b): the agent now refuses to
  finalize a spec while any mandatory requirement lacks at least one EARS
  acceptance criterion — it returns another question round asking for the
  missing trigger/observable response instead. `[NEEDS CLARIFICATION]` no
  longer substitutes for a missing AC. The final summary states the gate
  verdict ("N/N mandatory requirements covered").
- `evals/cases/EVAL-08-spec-creator-ac-coverage-gate.md` — behavior check
  for the new gate.

Backward compatible: specs that previously passed still pass; the gate only
blocks specs that would have shipped uncovered mandatory requirements.
Dependencies unchanged (`^1.0.0`).

## [1.0.0] - 2026-07-12

### Added

- Initial release, extracted from the DevDigest engineering harness:
  - agents `spec-creator`, `implementation-planner`, `implementer`,
    `plan-verifier` (+ their reference files: spec template, EARS guide,
    verification worked example);
  - skills `run-plan` (renamed from `impl`), `workflow-retro`,
    `engineering-insights`;
  - `workflow-retro/scripts/analyze_journals.py` — the journal aggregator,
    materialized from the previously ad-hoc scratchpad procedure and invoked
    via `${CLAUDE_SKILL_DIR}`;
  - behavior smoke evals `EVAL-01..07` + `run-smoke.sh`.
- Version-constrained dependencies on `engineering-paved-path@^1.0.0`,
  `research-tools@^1.0.0`, `architecture-review@^1.0.0`.

### Changed (relative to the origin harness)

- All cross-component references are plugin-namespaced
  (`engineering-paved-path:*`, `research-tools:researcher`,
  `architecture-review:architecture-reviewer`, `sdd-engineering:*`).
- Repository assumptions replaced with runtime discovery: the planner's
  hardcoded package map became a discovery procedure; repo-specific rules
  bind implementers only when the plan states them.
- Missing-test-command behavior documented end-to-end: implementers fall
  back to typecheck-only and report it; the planner plans for it.
- The pre-PR hook coupling removed: run-plan's final step is
  confirm-then-`gh pr create`; host-repo hooks fire on their own. No hooks
  ship with this plugin.
- spec-creator's repository-intel MCP tools became an optional integration
  with a documented fallback (docs + code search); removed from required
  `tools:`.
- engineering-insights routing generalized from a fixed module table to
  nearest-`INSIGHTS.md` (with consent-gated root-file creation).
- The architecture gate consumes the generalized reviewer's
  PASS / FAIL / NOT-APPLICABLE verdicts; NOT-APPLICABLE is a visible skip.
- Agent reference files are addressed via `${CLAUDE_PLUGIN_ROOT}/references/…`.
- User-facing language is the user's own; artifacts stay English.
