# Changelog

All notable changes to `architecture-review` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [1.0.0] - 2026-07-12

### Added

- Initial release: the `architecture-reviewer` agent, generalized from the
  DevDigest harness.
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
