# Changelog

All notable changes to `architecture-review` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [Unreleased]

### Added

- README now warns that **disabling `engineering-paved-path` disables this
  plugin too, silently** — a plugin whose declared dependency is disabled does
  not load, with no warning, while still reading `true` in `enabledPlugins`,
  so the symptom is that `architecture-review:architecture-reviewer` is simply
  absent. This plugin uses that dependency for one optional enrichment; making
  that expressible without a hard dependency is tracked separately.

### Changed

- Dependency range widened to `engineering-paved-path@^1.0.0 || ^2.0.0`. This
  plugin uses exactly one thing from that dependency — the optional
  `engineering-paved-path:onion-architecture` enrichment — and that skill
  exists in both majors, so accepting both avoids forcing a major bump here for
  a change that does not affect this plugin's behavior. This is the documented
  exception to the default caret range in `CONTRIBUTING.md`.
- The worked example rule set no longer names a specific HTTP framework that
  the marketplace does not serve; the forbidden-imports illustration reads
  `@nestjs/common`, `express`, `http`. It remains an *example* of a
  repository's own rule — the reviewer enforces only what the repository
  documents.

No behavior change to the agent, its tools, or its verdict format.

## [1.0.0] - 2026-07-12

### Added

- Initial release: the `architecture-reviewer` agent.
- `references/rule-format.md` — the canonical structural-rule format
  (identifier, scope, constraint, severity table) and discovery locations.
- `references/example-rules.md` — a worked four-rule example set (layering
  direction, DI discipline, pure-package zero-I/O, mandatory output gate).

### Changed

- Contract discovery replaced hardcoded rules: the agent now reads
  `docs/architecture/rules/*.md` → `docs/architecture/*.md` →
  `ARCHITECTURE.md` and enforces only what the repository documents.
- New `NOT-APPLICABLE` gate verdict for repositories without documented
  contracts — an explicit skip, never a fake PASS.
- Declared dependency on `engineering-paved-path@^1.0.0` for interpreting
  layering/DI rule background.
