# Plugin guidelines

Technical requirements for every plugin in this marketplace. CONTRIBUTING.md
describes the process; this file describes the artifact.

## Naming

- Plugin, skill, and agent names: kebab-case, descriptive, no `claude-` or
  `plugin-` prefixes (`engineering-paved-path`, not `claude-eng-skills`).
- One concept per plugin. If a component has its own consumer scenario outside
  the plugin's lifecycle, it belongs in its own plugin (that is why
  `researcher` and `architecture-reviewer` are not inside `sdd-engineering`).
- A component keeps one canonical home. Shared knowledge lives once in
  `engineering-paved-path` and is referenced by namespace — never copied into
  another plugin.

## Required structure

```
plugins/<name>/
├── .claude-plugin/plugin.json
├── skills/<skill-name>/SKILL.md      # + optional scripts/, references/, rules/
├── agents/<agent-name>.md
├── references/                       # agent supporting files
├── evals/                            # behavior checks (README + cases)
├── README.md                         # composition, usage, install command
├── CHANGELOG.md                      # Keep a Changelog; ## [x.y.z] - YYYY-MM-DD
└── COMPATIBILITY.md                  # minimum Claude Code version + reasons
```

`skills/` and `agents/` are auto-discovered by Claude Code — do not add
`skills`/`agents` path fields to `plugin.json` unless the layout deviates
(and it should not).

## plugin.json

```json
{
  "name": "sdd-engineering",
  "version": "1.0.0",
  "description": "One sentence a stranger can act on.",
  "author": { "name": "…" },
  "keywords": ["sdd", "workflow"],
  "dependencies": [
    { "name": "engineering-paved-path", "version": "^1.0.0" }
  ]
}
```

- `name` is required; keep it equal to the directory name and marketplace
  entry name.
- **`version` lives here and only here.** Never set a version in the
  marketplace entry — `plugin.json` silently wins and `claude plugin tag`
  requires the two to agree.
- `dependencies[].version` is a node-semver range; default to caret ranges.
- **A declared dependency is load-bearing in a way that fails silently.**
  Disabling a plugin also unloads every plugin that declares it — with **no
  warning**, and while the dependent still reads `true` in `enabledPlugins`.
  A consumer who disables one plugin for their own reasons can therefore lose
  an unrelated workflow entirely, and the symptom is absence, not an error:
  agents and skills simply are not there, and every document describing them
  keeps saying they are. Two obligations follow:
  - **Declare a dependency only for something the plugin genuinely requires.**
    If a component merely *may* consult another plugin's skill when present,
    that is an optional enrichment: reference it by namespace, state the
    fallback, and do **not** put it in `dependencies`.
  - **Say so where a consumer will look.** Any plugin with dependencies
    documents in its README that disabling them takes this plugin down too.
- No secrets anywhere in the manifest. A manifest may *name* a secret slot
  (e.g. an env var the user must provide); it never contains a value.

## Namespacing

Installed components are addressed as `<plugin-name>:<component>`:

- skills: `engineering-paved-path:zod`, `sdd-engineering:run-plan`
  (slash-invocable as `/sdd-engineering:run-plan`);
- agents: `research-tools:researcher`,
  `architecture-review:architecture-reviewer`.

Every cross-component reference in skill and agent bodies must use the
namespaced form — bare names resolve only by accident and break outside the
origin repository. This includes references to the plugin's *own* components.

## Path variables

- `${CLAUDE_SKILL_DIR}` — inside a SKILL.md: the directory containing that
  SKILL.md. Use it for the skill's own `scripts/` and `references/`.
- `${CLAUDE_PLUGIN_ROOT}` — inside agent files (and hooks/MCP configs): the
  installed plugin root. Use it for `references/` shipped at plugin level.
- Never use absolute paths, `~`, or `../` escapes. Installed plugins are
  copied into the plugin cache; anything outside the plugin directory does not
  exist there.

## Explicit inputs, graceful degradation

Extracted components must not assume any repository layout:

- Each agent/skill opens with an "Inputs" statement: what the caller provides,
  and what happens when it is missing (ask — never guess).
- Output locations are documented in the component and the plugin README
  (specs → `specs/`, plans → `docs/plans/`, retro ledger →
  `docs/retros/ledger.md`, insights → nearest `INSIGHTS.md`).
- Optional integrations (e.g. convention MCP tools) degrade silently: if the
  tool is absent, fall back to documented sources; never fail the workflow.
- Missing test command: report "no test command found" and continue with the
  documented fallback (e.g. typecheck-only) — never fail silently, never
  invent commands.

## Respect the host's infrastructure and dependencies

A plugin is a guest. It works with the stack, versions, package manager and
tooling the host project already has — it does not install, upgrade, or
require anything to make its own guidance apply.

- **Never install, add, or upgrade a host dependency.** Not as a step, not as
  a precondition, not "while we're here". That includes lockfiles, root
  `package.json`, tool versions, and the package manager. Agents that write
  code must list these among their forbidden paths.
- **Never make a version bump the price of following a skill.** If guidance
  only holds on a newer major, say so and state what the older major does
  instead — a reader on the older line must be able to act correctly without
  upgrading first. Version-dependent claims carry a *since vN* marker in both
  directions; what is stable across majors is stated as such.
- **A dependency change is a proposal, not an instruction.** When a finding
  genuinely implies one (an unmaintained package, a broken toolchain
  pairing), surface it as a decision for the project's owners, with the
  options and their costs. Never phrase it as a step, and never fold it into
  an unrelated change.
- **Whatever the project already uses is what to write.** Do not introduce a
  second library for a job the host already solved because the skill prefers
  a different one.
- **Write against the seam, not the package.** Where a framework provides an
  extension point and the ecosystem provides packages that fill it, the
  durable guidance is the seam — the rule holds whichever package the host
  picked, or none. State up front which parts of the stack are always present
  and which are separate packages a project may not have, then show a
  specific library as *one instantiation*, clearly labelled. A skill whose
  advice evaporates when the host swapped one library for another was written
  against the wrong thing.
- **Read the project's reality before advising.** Package manager and
  workspace topology come from its lockfiles; framework and ORM majors from
  its manifest — never from this marketplace's baseline tables, which record
  what was current when the skill was written.

The test: if following a skill's advice requires `npm install`, a version
bump, or a tooling swap before the advice works, the skill is imposing its
own infrastructure and needs rewriting.

## Hooks policy (v1)

Plugins in this marketplace ship **no lifecycle hooks**. Gates that were
hook-driven in the origin repository (e.g. a pre-PR review hook) become
explicit workflow steps. Host repositories keep their own hooks; a plugin must
not assume or override them. Revisit only with a documented consumer scenario
and a security review.

## Editorial checklist

Run before every PR that adds or updates plugin content. Where content is
adapted from a working repository, generalize it — mine the finding, then strip
the module names, table and column names, paths and local conventions until
what remains is a statement about the technology that holds for any project.

1. `grep -riE '<origin-repo-name>' plugins/<name>/` → **zero hits**, including
   in CHANGELOG and version-history lines. A plugin must never be shaped by,
   depend on, or be justified by a particular repository; "repository X needs
   it this way" is an argument that belongs in X. Attribution is not an
   exception: naming the repository a component came from tells a consumer
   nothing they can act on, and it is the thread by which repository-specific
   assumptions creep back in.

   Removing attribution never means rewriting what a release *did*. Drop the
   origin clause and leave every factual claim about the release intact
   ("Initial release, extracted from the X harness: agents …" → "Initial
   release: agents …").

   Citing an external source — documentation, a specification, a public
   reference implementation — is a different thing and is required, not
   discouraged. Record those URLs verbatim in the component's `README.md`.
2. `grep -rF '.claude/' plugins/<name>/` → 0 hits; use path variables.
3. `grep -rF 'mcp__' plugins/<name>/` → no required MCP tools in `tools:`
   frontmatter; body may mention optional tools with a fallback.
4. All cross-references namespaced (own components included).
5. `tools:` lines audited: minimal set, no Write/Edit for read-only agents.
6. `grep -rniE 'npm i(nstall)?|pnpm add|yarn add|bun add' plugins/<name>/` →
   no install command presented as a step the reader is expected to run to
   make the guidance apply. Setup snippets for a *new* project are fine when
   labelled as such; a precondition attached to existing-code guidance is
   not. See "Respect the host's infrastructure and dependencies".
7. Version-dependent claims carry a *since vN* marker, and state the older
   behavior wherever getting it backwards would break working code.
8. Inputs stated; missing-input behavior stated.
9. Output paths documented in-file and in the plugin README.
10. No secrets, no absolute paths, no personal URLs. Prose in English;
   functional trigger phrases in other languages may stay; replace "respond in
   <language>" with "respond in the user's language".
