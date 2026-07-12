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

## Hooks policy (v1)

Plugins in this marketplace ship **no lifecycle hooks**. Gates that were
hook-driven in the origin repository (e.g. a pre-PR review hook) become
explicit workflow steps. Host repositories keep their own hooks; a plugin must
not assume or override them. Revisit only with a documented consumer scenario
and a security review.

## Extraction editorial checklist

Run before every PR that adds or updates extracted content:

1. `grep -riE 'devdigest|dev-digest' plugins/<name>/` → only attribution lines
   in README/CHANGELOG (origin credit is fine; behavior references are not).
2. `grep -rF '.claude/' plugins/<name>/` → 0 hits; use path variables.
3. `grep -rF 'mcp__' plugins/<name>/` → no required MCP tools in `tools:`
   frontmatter; body may mention optional tools with a fallback.
4. All cross-references namespaced (own components included).
5. `tools:` lines audited: minimal set, no Write/Edit for read-only agents.
6. Inputs stated; missing-input behavior stated.
7. Output paths documented in-file and in the plugin README.
8. No secrets, no absolute paths, no personal URLs. Prose in English;
   functional trigger phrases in other languages may stay; replace "respond in
   <language>" with "respond in the user's language".
