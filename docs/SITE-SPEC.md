# Site specification — static catalog UI

Discovery front-end for the marketplace, published on GitHub Pages at
`https://yamchinsky.github.io/dev-digest-ai-marketplace/`. The CLI remains
the way to install; the site exists to **find** a plugin or an individual
skill/agent, read its documentation, see its dependencies, and copy the
install command.

## Non-goals (v1)

No backend, no authentication, no ratings, no download counters, no SSR, no
analytics. The repository files are the only data source; the UI is never
edited by hand.

## Data pipeline

`scripts/build-index.mjs` (Node ≥ 20, stdlib only, hand-rolled frontmatter
parser) reads `.claude-plugin/marketplace.json`, each plugin's
`.claude-plugin/plugin.json`, `README.md`, `CHANGELOG.md`,
`COMPATIBILITY.md`, and the frontmatter + body of every `skills/*/SKILL.md`
and `agents/*.md`. It generates (git-ignored):

```
site/public/
├── index.json      # everything searchable
├── releases.json   # What's new feed
├── stats.json      # homepage counters
└── bodies/         # raw markdown, fetched lazily by the SPA
    ├── <plugin>--README.md
    ├── <plugin>--CHANGELOG.md
    └── <plugin>--<type>--<component>.md
```

### `index.json`

```jsonc
{
  "generatedAt": "<iso>",
  "marketplace": {
    "name": "dev-digest-ai-marketplace",
    "description": "…",
    "owner": "…",
    "repoUrl": "https://github.com/yamchinsky/dev-digest-ai-marketplace",
    "addCommand": "claude plugin marketplace add yamchinsky/dev-digest-ai-marketplace"
  },
  "plugins": [
    {
      "name": "sdd-engineering",
      "version": "1.0.0",
      "description": "…",
      "author": "…",
      "keywords": ["sdd", "…"],
      "category": "workflow",
      "tags": ["…"],
      "compatibility": "Claude Code >= 2.1.196",   // first line, when COMPATIBILITY.md exists
      "dependencies": [{ "name": "engineering-paved-path", "version": "^1.0.0" }],
      "installCommand": "claude plugin install sdd-engineering@dev-digest-ai-marketplace",
      "counts": { "skills": 3, "agents": 4 },
      "readmePath": "bodies/sdd-engineering--README.md",
      "changelogPath": "bodies/sdd-engineering--CHANGELOG.md",
      "updatedAt": "<iso of latest CHANGELOG release date>",
      "artifacts": [
        {
          "id": "sdd-engineering:run-plan",     // plugin:name — the deep-link key
          "plugin": "sdd-engineering",
          "type": "skill",                       // "skill" | "agent"
          "name": "run-plan",
          "description": "<frontmatter description>",
          "tools": "<agents: tools line, if any>",
          "model": "<agents: model, if any>",
          "bodyPath": "bodies/sdd-engineering--skill--run-plan.md",
          "searchText": "<name + description + body text, plain>"
        }
      ]
    }
  ]
}
```

### `releases.json`

One entry per `## [x.y.z] - YYYY-MM-DD` section found in any plugin
CHANGELOG, newest first:

```jsonc
[
  {
    "plugin": "sdd-engineering",
    "version": "1.1.0",
    "date": "2026-07-12",
    "tag": "sdd-engineering--v1.1.0",
    "highlights": ["<first ≤3 bullet lines of the section>"]
  }
]
```

### `stats.json`

```jsonc
{
  "generatedAt": "<iso>",
  "totals": { "plugins": 4, "skills": 15, "agents": 6 },
  "byPlugin": { "sdd-engineering": { "skills": 3, "agents": 4 } }
}
```

## Application

`site/` — Vite + React + TypeScript, no backend calls, hash routing (works
on Pages without rewrite rules). `vite.config.ts` sets
`base: '/dev-digest-ai-marketplace/'`.

### Routes

| Route | Screen |
|---|---|
| `#/` | Home: hero search box, keyword chips, counters from `stats.json`, What's new strip (top 5 from `releases.json`), browse-by-type links |
| `#/search?q=…&type=…` | Search results with type filter chips (all / plugins / skills / agents), fuzzy matching, match highlighting |
| `#/plugin/<name>` | Plugin detail: version, compatibility, owner, updated date, install command + **Copy**, View on GitHub link, dependencies (linked), composition (skills/agents lists linked to artifact pages), rendered README |
| `#/artifact/<plugin>:<name>` | Artifact detail: name, type badge, plugin (linked), description, invocation (`/plugin:skill` for skills; agent usage note for agents), tools/model when present, install command of the parent plugin + Copy, rendered SKILL.md / agent markdown |
| `#/whats-new` | Full release feed from `releases.json` |
| `#/getting-started` | Static page: add-marketplace + install + update commands, links to CONTRIBUTING/GUIDELINES on GitHub |

### Search

MiniSearch over `index.json` — documents = plugins **and** artifacts; fields:
`name`, `description`, `keywords`, `searchText`; `prefix: true`,
`fuzzy: 0.2`; boost `name`. Filters by document type. Highlight matched
terms in result snippets. **Cmd/Ctrl+K** opens a command palette (same
index, keyboard-first) from any screen.

### Rendering & chrome

- Markdown rendered with `marked`, sanitized with `DOMPurify` **before**
  insertion (mandatory — plugin bodies are repo-controlled but the pipeline
  must not rely on that).
- Light/dark theme toggle (`prefers-color-scheme` default, persisted in
  `localStorage`).
- All UI strings come from one i18n dictionary module (`src/lib/i18n.ts`,
  `en` + `uk`); components contain **no hardcoded UI text** and no hardcoded
  counters — numbers always come from the generated JSON.
- Runtime deps kept minimal: `react`, `react-dom`, `minisearch`, `marked`,
  `dompurify` (+ dev types). Routing is a small hash-router hook — no
  router dependency.

## Build & deploy

Local:

```bash
node scripts/build-index.mjs
cd site && npm ci && npm run build && npm run preview
```

CI (`.github/workflows/`):

- `site-build.yml` — every PR: build index → `npm ci && npm run build` in
  `site/` → `claude plugin validate . --strict` (offline; installs the CLI
  via npm).
- `pages.yml` — every push to `main`: same build → `actions/configure-pages`
  (`enablement: true`) → `actions/upload-pages-artifact` (`site/dist`) →
  `actions/deploy-pages`. Permissions: `pages: write`, `id-token: write`.

Generated JSON, `bodies/`, and `site/dist/` are git-ignored — the site is
rebuilt from repository files on every deploy; manual edits to generated
data are impossible by construction.

## Acceptance (per release)

After a plugin change lands on `main`: the plugin appears in the catalog;
search finds it **and** its nested skills/agents; the counters recompute;
the release shows in What's new; the detail page shows the correct version
and dependencies; **Copy install** copies the exact command.
