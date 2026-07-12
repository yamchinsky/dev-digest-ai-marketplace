---
name: workflow-retro
description: >
  Use to run a MANUAL retrospective of a multi-agent run (the SDD pipeline or
  any session with subagents): computes token metrics (input / output /
  cache-read / cache-creation, cache-hit rate), tool-call counts, durations,
  and parallelism — INCLUDING nested subagents, whose usage the parent does
  not count (deep mode reads their journals from disk) — then produces
  insights + concrete recommendations and appends a trend row to
  docs/retros/ledger.md. Trigger phrases: 'workflow retro', 'ретро прогону',
  'retro the run', '/workflow-retro'. Manual only — never fired by a hook.
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# workflow-retro

Post-run retrospective for multi-agent workflows. The SDD pipeline
(`sdd-engineering:spec-creator` → `sdd-engineering:implementation-planner` →
implementers → the review gates, plus nested researchers) is already a
multi-agent run — after it finishes, run this skill to see how the run
*actually* went. The ledger is the input for cost trend reports.

## Inputs

Optionally: a session id (or journal path) and `--shallow`. With no session
named, the most recent session journal of the current project is analyzed —
the report must state which one was chosen.

## 1. Locate the journals

- Project transcript dir:
  `~/.claude/projects/<project-slug>/` where `<project-slug>` is the session
  cwd with `/` replaced by `-` (e.g. `/home/dev/acme-shop` →
  `-home-dev-acme-shop`).
- **Session journal**: `<dir>/<session-uuid>.jsonl`. If the user did not name
  a session, take the most recently modified `.jsonl` in the project dir
  (that is the current session) — confirm the choice in the report.
- **Subagent journals (deep mode — the DEFAULT)**:
  `<dir>/<session-uuid>/subagents/agent-<id>.jsonl` + `agent-<id>.meta.json`.
  The parent's `usage` does NOT include subagent tokens, so an in-context
  estimate undercounts — deep mode reads these files from disk. `--shallow`
  skips them (and must say so in the report).

## 2. Compute metrics — by script, not by eye

Never aggregate JSONL in-context (journals are megabytes). Run the bundled
aggregator:

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/analyze_journals.py" <session-journal.jsonl> [--shallow] [--json]
```

The script discovers the session's subagent journals automatically (deep
mode), and guarantees the rules the numbers depend on:

1. **Usage deduped by message uuid.** Streaming writes the same assistant
   message (and its `usage`) multiple times — the script keeps ONE usage per
   message `uuid` (the last occurrence), otherwise all token numbers are
   inflated several-fold.
2. Per actor (main session + each `agent-*.jsonl`):
   - tokens: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
     `cache_read_input_tokens` (summed over deduped messages);
   - **cache-hit** = `cache_read / (input + cache_creation + cache_read)`;
   - **tool-calls** by tool name (from deduped `tool_use` content blocks);
   - **duration** = last − first entry `timestamp`.
3. **Parallelism**: from each subagent's `meta.json` (or its journal's
   first/last timestamps) it builds [start, end] intervals and reports the
   maximum number of simultaneously live subagents plus the total serial
   stretch where nothing ran in parallel.
4. It prints a compact markdown summary (default) or JSON (`--json`) — that
   is what enters the context.

Only fall back to an ad-hoc scratchpad script if the bundled one cannot read
a journal format variant — and say so in the report.

## 3. Insights & recommendations

Read the aggregated numbers (plus targeted greps into journals when a number
looks odd) and answer, concretely:

- **What was hard** — which agent burned the most output tokens / retries /
  longest duration, and why.
- **What was duplicated in context** — the same file Read by several agents
  (grep tool_use inputs for repeated `file_path`s) → recommend pre-fetching
  it into the orchestrator prompt or the plan.
- **What was missed** — errors, denied tools, malformed outputs that forced
  re-runs.
- **Concrete actions only**: tighten a specific agent's brief, pre-fetch a
  named shared file, merge or split specific agents, change the concurrency
  cap. "Be more efficient" is not a recommendation.

## 4. Ledger — the trend line

Append ONE row to `docs/retros/ledger.md` (in the host repository). If the
file does not exist, create it with this header first:

```markdown
# Workflow retro ledger

One row per analyzed run — the trend of the SDD pipeline over time.

| Date | Run (plan/feature) | Agents | In / Out / CacheRead (tokens) | Cache-hit | Tool-calls | Duration | Max ∥ | Top recommendation |
|---|---|---|---|---|---|---|---|---|
```

Row values come from §2; `Top recommendation` is the single highest-leverage
action from §3.

## 5. Report (to the user)

- Which session/journals were analyzed (paths, mode deep/shallow).
- Metrics table per actor + totals.
- Parallelism picture (max simultaneous, serial stretches).
- Insights → recommendations (each actionable).
- The ledger row that was appended.

## Hard rules

1. **Manual only** — never wire this skill to a hook; it runs when the user
   decides a run is worth dissecting.
2. **Journals are read-only.** The ONLY writes: `docs/retros/ledger.md` and
   scratchpad intermediates.
3. **Deep mode is the default** — subagent tokens are the point; a shallow
   run must be labeled as an undercount.
4. **Dedupe by message uuid before summing** — inflated numbers are worse
   than no numbers.
5. **Script-based aggregation** — never paste raw JSONL into context.
6. One run per invocation; one ledger row per run.

## Language

Report and recommendations in the **user's language**; the ledger row in
**English** (repo artifact).
