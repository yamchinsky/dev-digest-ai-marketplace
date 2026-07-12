# Contributing

This document describes the path from an idea to a merged pull request. A new
author should be able to prepare a contribution using only this file and
[docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) — no verbal context.

## From proposal to pull request

1. **Open an issue** describing the component (skill, agent, or whole plugin),
   who needs it outside its origin repository, and which existing plugin it
   belongs to (or why it needs a new one).
2. **Get a placement decision** from a code owner: target plugin, canonical
   name, and whether it is a new plugin (new plugins need a `CODEOWNERS`
   entry and a release owner).
3. **Prepare the change on a branch** following the structure and editorial
   rules in `docs/PLUGIN-GUIDELINES.md`.
4. **Run the pre-release checks** (below) locally.
5. **Open a pull request** using the checklist (below). A code owner reviews;
   only code owners release.

## Naming and structure (summary — full rules in PLUGIN-GUIDELINES.md)

- Plugin, skill, and agent names are kebab-case.
- Required plugin layout:

  ```
  plugins/<name>/
  ├── .claude-plugin/plugin.json    # name (required), version, description,
  │                                 # author, keywords, dependencies
  ├── skills/<skill-name>/SKILL.md  # auto-discovered
  ├── agents/<agent-name>.md        # auto-discovered
  ├── references/                   # supporting files, addressed via
  │                                 # ${CLAUDE_PLUGIN_ROOT} (agents) or
  │                                 # ${CLAUDE_SKILL_DIR} (skills)
  ├── README.md                     # what it is, composition, usage
  ├── CHANGELOG.md                  # Keep a Changelog format, ## [x.y.z] - date
  └── COMPATIBILITY.md              # minimum Claude Code version + why
  ```

- Cross-component references are always plugin-namespaced
  (`engineering-paved-path:zod`, `research-tools:researcher`) — never bare
  names, never relative paths into another plugin.

## Dependencies

- Declare dependencies in `plugin.json` as
  `{ "name": "<plugin>", "version": "<semver range>" }`. Use caret ranges
  (`^1.0.0`) unless there is a documented reason not to.
- A dependency must be resolvable inside this marketplace.
- Adding or widening a dependency is a minor version bump at minimum; removing
  or narrowing one is breaking.

## Hard rules

- **No secrets.** A manifest may name a secret slot; it must never contain a
  credential, token, or key.
- **No absolute paths** and no paths into any specific repository. Use
  `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` for files shipped with the
  plugin, and explicit caller inputs for everything else.
- **No network calls in supporting scripts.**
- **English** for all plugin content, docs, commits, and PR bodies.

## Pre-release checks (run before every PR)

```bash
claude plugin validate ./plugins/<name> --strict   # schema validation
claude plugin validate . --strict                  # whole marketplace
```

- Run the plugin's evals (see the plugin's `evals/README.md`) — schema
  validation proves the manifest shape; evals prove behavior. One does not
  replace the other.
- For behavior-affecting changes: load the plugin with `claude --plugin-dir`
  in a real project and walk the affected eval cases.
- For dependency or packaging changes: perform a scratch install from a local
  marketplace checkout and confirm the dependency resolution.

## CHANGELOG rules

- Every user-visible change gets an entry under `## [Unreleased]` in the
  plugin's `CHANGELOG.md`; the release process turns it into `## [x.y.z] - date`.
- Entries describe behavior change, not file names.

## Pull request checklist

Copy into the PR body and fill in:

```markdown
- **What changed:** …
- **Why this is not a breaking change** (or the major-bump justification): …
- **Permissions added/changed** (agent `tools:` lines): …
- **Dependencies added/changed:** …
- [ ] `claude plugin validate . --strict` passes
- [ ] Plugin evals pass (list the cases you ran)
- [ ] CHANGELOG.md updated
- [ ] No secrets, no absolute paths, no repo-specific assumptions
```

## Releases

Only code owners release. See [docs/RELEASES.md](docs/RELEASES.md) for the tag
convention, dependency-first ordering, and rollback procedure.
