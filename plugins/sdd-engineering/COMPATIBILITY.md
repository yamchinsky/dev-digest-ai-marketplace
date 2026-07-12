# Compatibility

**Requires Claude Code >= 2.1.196.**

Why this floor:

- **Local-folder marketplace tag resolution (2.1.196)** — a marketplace added
  as a local folder path resolves `{plugin-name}--v{version}` tags the same
  way a GitHub-sourced one does. The pre-release validation protocol for this
  plugin (install from a local checkout with version-constrained
  dependencies) relies on it.
- **`${CLAUDE_PROJECT_DIR}` substitution inside skills (2.1.196)** — skill
  bodies referencing project-root paths resolve correctly.

Earlier capabilities this plugin also depends on (all satisfied by the floor):

- Dependency version constraints in `plugin.json` — 2.1.110+.
- Coordinated (transitive) enable/disable of dependencies — 2.1.143+.
- `${CLAUDE_SKILL_DIR}` / `${CLAUDE_PLUGIN_ROOT}` substitutions for bundled
  scripts and references.

Other requirements:

- `python3` on PATH — for `workflow-retro`'s bundled
  `analyze_journals.py` (stdlib only, offline).
- `gh` CLI authenticated — for the final `gh pr create` step of `run-plan`.
