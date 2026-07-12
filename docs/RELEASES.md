# Releases

## Versioning

- Each plugin follows **SemVer** independently; the version lives **only** in
  its `plugin.json`.
  - **patch** — fixes and wording that do not change behavior contracts;
  - **minor** — backward-compatible behavior additions (new skill, stricter
    optional gate, new eval), plus any dependency addition/widening;
  - **major** — removed/renamed components, changed output contracts,
    narrowed/removed dependencies, raised compatibility floor.
- SemVer explains the *nature* of a change; the tag's commit SHA identifies
  the exact bytes. Both matter: constraints resolve on versions, audits rely
  on SHAs.
- The marketplace itself is not released as a product. The catalog state is
  pinned by any commit/tag of this repository; installs record which state
  they came from.

## Tags

- Convention: `{plugin-name}--v{version}` (e.g. `sdd-engineering--v1.0.0`).
  The double-dash separator lets the resolver distinguish hyphenated plugin
  names from versions in a multi-plugin repository.
- Tags are **immutable**. Never force-move or delete a released tag — ship a
  patch release instead (see SECURITY.md for the incident variant).
- Create tags with the CLI, which validates the working tree and the
  plugin.json ↔ marketplace agreement:

  ```bash
  claude plugin tag plugins/<name> --push
  ```

## Release procedure

1. All changes merged to `main`; working tree clean; CI green.
2. CHANGELOG.md: `## [Unreleased]` → `## [x.y.z] - YYYY-MM-DD`.
3. `plugin.json` version bumped in the same PR as the CHANGELOG flip.
4. Run pre-release checks (CONTRIBUTING.md): strict validation + plugin evals.
5. Tag **dependencies first, consumers last** so constraint resolution never
   sees a consumer without a satisfiable dependency:

   ```bash
   claude plugin tag plugins/engineering-paved-path --push
   claude plugin tag plugins/research-tools --push
   claude plugin tag plugins/architecture-review --push
   claude plugin tag plugins/sdd-engineering --push
   ```

6. Verify: `git ls-remote --tags origin | grep -- '--v'` lists the new tags.

## Consumer update flow

Two distinct commands — refreshing the catalog does not update installed
plugins:

```bash
claude plugin marketplace update dev-digest-ai-marketplace   # refresh catalog
claude plugin update <plugin>@dev-digest-ai-marketplace      # update install
```

Start a new session after updating; verify the new version appears in
`claude plugin list` **and** the new behavior appears in a real trace — the
version number alone is not proof.

## Rollback

- Consumer-side: `claude plugin uninstall` then install the previous version
  (constraint or tag), or pin the dependency range in the consumer plugin.
- Marketplace-side: tags never move. If a release must be withdrawn, publish a
  patch/minor that reverts the behavior and (for harmful releases) pull the
  entry from `marketplace.json` per SECURITY.md.
