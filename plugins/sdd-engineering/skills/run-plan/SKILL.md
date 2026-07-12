---
name: run-plan
description: >
  Use to EXECUTE an Implementation Plan (`docs/plans/<feature>.md`) end-to-end
  in the main session: feature branch → implementer waves per the task DAG
  (or sequential steps in single-agent mode) → plan-verifier coverage gate
  (run inside a subagent) → capped gap-fix loop → architecture review gate
  with a capped fix loop (≤3, until PASS) → spec status flip → confirm and
  `gh pr create`. Trigger phrases: '/run-plan', '/impl', 'імплементуй план',
  'implement the plan', 'run the plan', 'execute the plan', 'виконай план',
  'запусти план'. NOT for writing plans (sdd-engineering:implementation-planner)
  or specs (sdd-engineering:spec-creator) — those are invoked manually,
  upstream of this skill.
allowed-tools: Read, Grep, Glob, Bash, Edit, Agent, Skill, AskUserQuestion
---

# run-plan

Execution orchestrator for the SDD pipeline. Upstream steps are manual by
design — the user runs `sdd-engineering:spec-creator` and
`sdd-engineering:implementation-planner` themselves; this skill picks up from
a finished plan:

```
spec-creator (manual) → SPEC-NN → implementation-planner (manual)
    → docs/plans/<feature>.md
    → /run-plan (THIS SKILL, main session):
        0. preflight: plan + spec + feature branch
        1. implementer waves per DAG (cap 3) | sequential steps
        2. plan-verifier agent — coverage gate, FIRST (subagent)
        3. gap-fix loop (max 2 iterations)
        4. architecture review gate → arch-fix loop (≤3, until PASS)
        5. test intents + DEFERRED rows → manual checklist (this workflow
           does not author tests)
        6. aggregate insight candidates → engineering-insights (once, serial)
        7. spec Status → implemented (+ specs/ README index line)
        8. confirm with the user → gh pr create (host-repo hooks, if any,
           fire here)
```

This skill runs in the **main session** deliberately: only the main session
has `AskUserQuestion` (failure decisions, gap acceptance, arch-loop cap) and
only it runs the final PR step predictably. Do not wrap this pipeline in a
subagent.

## Inputs

- A plan at `docs/plans/<feature>.md` (named by the user, or inferred — see
  Preflight). Without a locatable plan, ask — never improvise one.
- The plan supplies everything else: execution mode, tasks, owned paths,
  skills, verify commands. Missing sections are plan defects (see Preflight 4).

## When to use

- User asks to execute a plan: "/run-plan", "/impl", "імплементуй план",
  "run the plan", "виконай план", or names a `docs/plans/<feature>.md` to run.
- An implementation-planner run just finished and the user confirms execution.

Do **not** fire:

- To write or amend a plan (that is `sdd-engineering:implementation-planner`,
  run manually).
- To verify coverage only (invoke `sdd-engineering:plan-verifier` directly).
- Mid-execution of another plan — one plan per run, finish or abort first.

## 0. Preflight

1. **Locate the plan.** If not named, infer from the branch name or the most
   recent file in `docs/plans/`; if still ambiguous, ask once.
2. **Read the plan fully.** Extract: `## Execution mode`, the Requirements
   table (R-IDs, `Covers AC` when present), the `Spec:` header (if the plan
   traces to a SPEC-NN, read that spec's ACs and verification hints too),
   tasks/steps with Owned paths + `Skills (mandatory)` + DAG edges,
   `## Test intents`, and `## Verification per task/step`.
3. **Branch gate.** `git branch --show-current`. On the default branch,
   create a feature branch (`feat/<plan-slug>`) before anything else —
   implementers run in the launch branch, and PRs must never originate from
   the default branch.
4. **Sanity-check the DAG** (multi-agent mode): owned paths disjoint across
   tasks, no dependency cycles, every `Skills (mandatory)` entry resolvable
   (a plugin-namespaced skill such as `engineering-paved-path:zod`, or a
   skill available in the host project — agents are not skills). A violation
   here is a **plan defect** — stop and send the user back to
   `sdd-engineering:implementation-planner` rather than improvising ownership.

## 1. Implementation

**Multi-agent mode** — topologically sort the task DAG into waves:

- A wave = all tasks whose `Depends-on` are already completed.
- Launch each wave's `sdd-engineering:implementer` instances **in parallel in
  a single message**, but cap at **3 concurrent instances**; a larger wave
  runs in batches of 3.
- Each implementer prompt must contain, verbatim from the plan: its task ID
  and text, **Owned paths**, **Skills (mandatory)** list, acceptance criteria,
  red flags, and the exact verify command for its package. Tell it which
  paths *other* tasks own (so "stop and report" beats improvisation).
- If the plan names no verify command and the package has no test script, the
  implementer proceeds typecheck-only and says so in its report — that is
  expected behavior, not a failure.
- Between waves, skim each report: files changed within owned paths, verify
  command green (or the documented typecheck-only fallback), handoff notes
  (migrations needed, contracts mirrored), **Insight candidates** (collect
  for §5).

**Single-agent mode** — run one `sdd-engineering:implementer` per step S1..Sn
sequentially, same prompt contract; the verify/review tail below is identical.

### Failure protocol (a task fails or "stops and reports")

1. Do **not** launch its dependents.
2. Let the current wave drain (already-running tasks finish).
3. Present the failing report to the user and ask via `AskUserQuestion`:
   **retry** with an amended task prompt / **re-plan** (back to
   `sdd-engineering:implementation-planner` with the failure as input) /
   **abort** the run.
4. Never silently reassign the failed task's owned paths to another instance.

## 2. Coverage gate — plan-verifier FIRST

Immediately after the last wave, spawn the **`sdd-engineering:plan-verifier`**
agent (a smaller model such as sonnet is sufficient — its methodology is
self-contained): pass it the plan path and the pre-tests flag, and have it
return the coverage matrix as its final message. This keeps the grep-heavy
verification off the expensive model and out of the main context; if the
matrix comes back malformed, re-spawn the agent once with a corrected prompt
before falling back to verifying inline.

Run it **before** the architecture review: a coverage gap means a follow-up
implementer will change the diff, and anything reviewed before that gets
reviewed twice; architecture review of an incomplete diff produces false
findings.

- Test-evidence sub-criteria ("suite green", "test exists for X") come back
  `DEFERRED (test evidence pending)` — this workflow does not author tests;
  route them to the manual checklist (§4). Do not treat DEFERRED as a gap.
- **Gap-fix loop, capped at 2 iterations:** for MISSING/PARTIAL rows, spawn
  follow-up implementer task(s) scoped to the gap (owned paths = the affected
  files), then re-run plan-verifier **on the gap rows only**. After 2
  iterations with remaining gaps, stop and ask the user: accept the gaps
  (descope) or re-plan. plan-verifier deliberately proposes no fixes — an
  unbounded loop thrashes.

## 3. Architecture review gate + fix loop

Launch the `architecture-review:architecture-reviewer` agent, scope: the
branch diff vs the default branch.

Possible verdicts:

- **PASS** → proceed to §4.
- **NOT-APPLICABLE** (the host repository documents no structural contracts)
  → record "architecture gate skipped: no documented contracts" in the final
  report — visibly, as a warning — and proceed to §4. Do not fabricate a
  review.
- **FAIL** → run the **architecture-fix loop (≤3 iterations)**:

1. Spawn ONE follow-up `sdd-engineering:implementer` whose task is exactly
   the review's CRITICAL + HIGH findings — quote each finding (rule id,
   `path:line`, evidence, fix direction) verbatim in its prompt. Its owned
   paths MUST include any test files whose imports break when files move,
   and its done-condition is the touched package's **existing** tests +
   typecheck re-run to green (or the typecheck-only fallback).
2. Re-invoke `architecture-review:architecture-reviewer` on the updated diff.
3. **PASS** → exit the loop. Still FAIL → next iteration with the
   *remaining* findings only. After 3 iterations without PASS, stop and ask
   the user (`AskUserQuestion`): accept the remaining findings (record them
   verbatim in the final report), keep fixing manually, or abort the run.

Loop discipline: never send the same findings to two parallel fixers; never
let a fix iteration touch paths outside the findings' files + their broken
test imports; count an iteration even when the reviewer surfaces *new*
findings caused by a fix.

## 4. Final re-check + manual checklist

- Re-run the plan-verifier agent (same pattern) on **previously-gapped
  rows only** after the gap-fix and arch-fix loops settle.
- Collect into a **manual checklist** in the final report:
  - all `DEFERRED` test-evidence rows + the plan's `## Test intents`
    (this workflow does not author tests — these are the user's to cover),
  - runtime acceptance criteria ("demo works", "response is fast"),
  - e2e-kind verification hints (`deferred — manual`; or run the project's
    existing e2e flows when the plan names them).
  Never silently drop any of these.

## 5. Insights — aggregate, then write once

Implementers do **not** write INSIGHTS.md themselves (parallel instances in
one tree would collide on a file no task owns). They report **Insight
candidates**; this skill deduplicates them and invokes
`sdd-engineering:engineering-insights` **once, serially**, routing each entry
per that skill's nearest-INSIGHTS.md rule.

## 6. Terminal duties

1. **Spec status flip.** If the plan traces to a SPEC-NN and the verdict is
   ALL COVERED (modulo user-accepted descopes; DEFERRED rows don't block):
   `Edit` the spec header `Status: approved` → `Status: implemented` **and**
   update the trailing status in the same `specs/` folder's README index
   line (it says `(draft)` or `(approved)` — leaving it stale is the known
   failure mode).
2. **Open the PR.** Confirm with the user, then `gh pr create`. If the host
   repository has its own pre-PR hooks or review gates, they fire here —
   never bypass or pre-empt them.

## Output contract (final report, English)

- **Plan / spec**: paths, execution mode, branch.
- **Waves**: task → implementer result (files, verify command, green?).
- **Coverage**: plan-verifier verdict per run; gap-loop iterations used;
  accepted descopes.
- **Architecture**: verdict (including NOT-APPLICABLE skip, when relevant);
  fix-loop iterations used; fixes applied and re-green evidence; accepted
  residual findings (verbatim), if any.
- **Manual checklist**: deferred test intents, runtime ACs, e2e hints.
- **Insights**: entries appended (target file + heading), or "none".
- **PR**: URL, or the blocking report if a host-repo gate stopped it.

## Hard rules

1. **Never run on the default branch** — branch first.
2. **Concurrency cap 3** implementers; parallel launches in a single message.
3. **plan-verifier before the architecture review** — coverage first, always;
   run it via a subagent, not inline.
4. **Gap-fix loop caps at 2** iterations, then the user decides.
5. **Architecture-fix loop caps at 3** iterations — then the user decides
   (accept findings / continue manually / abort).
6. **A failed task never blocks silently** — failure protocol §1, user decides.
7. **No ownership improvisation**: plan defects (overlapping paths, cyclic
   DAG, agent names in `Skills (mandatory)`) go back to the planner.
8. **INSIGHTS.md is written once, by this skill** — never by parallel
   implementers.
9. **Host-repo gates are respected** — don't pre-empt them, don't bypass them.
10. **This workflow does not author tests** — deferred test work goes to the
    manual checklist, visibly.
11. One plan per invocation.

## Language

Progress narration, questions, and the final report to the user are in the
**user's language**; artifacts (PR body, plan annotations) in **English**.
