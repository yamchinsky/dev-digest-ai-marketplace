# Changelog

All notable changes to `engineering-paved-path` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: SemVer.

## [1.0.0] - 2026-07-12

### Added

- Initial release: 12 knowledge skills extracted from the DevDigest harness —
  react-best-practices, react-testing-library, next-best-practices,
  frontend-architecture, fastify-best-practices, onion-architecture,
  drizzle-orm-patterns, postgresql-table-design, zod, typescript-expert,
  security, mermaid-diagram — with their supporting rule files, references,
  and examples.

### Changed

- `onion-architecture` generalized: repository-specific paths and package
  names replaced with generic `src/` / `engine/` / shared-contracts
  equivalents; repository-local convention references removed.
- Cross-skill references rewritten to plugin-namespaced form
  (`engineering-paved-path:<skill>`).
- References to skills not shipped in this marketplace removed from skill
  descriptions.
