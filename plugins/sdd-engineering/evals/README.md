# sdd-engineering evals

Behavior checks for the plugin. Schema validation (`claude plugin validate
--strict`) proves the manifest has the right shape; these evals prove the
components behave. One does not replace the other.

## Shape

Each case in `cases/EVAL-NN-*.md` defines: Purpose, Setup, Prompt, Pass
signals, Fail signals. Cases are **manually driven smoke scenarios**: run the
prompt in a session that loads the plugins, then judge the observable signals.
`run-smoke.sh` prints the ready-to-copy command per case.

They are deliberately not an automated LLM-judged harness — the origin
repository keeps its own vitest eval infrastructure for that; vendoring it
here would couple the plugin to external judge models and API keys. When this
marketplace grows CI-run behavioral evals, they will build on these cases.

## Running

From a checkout of this repository:

```bash
plugins/sdd-engineering/evals/run-smoke.sh          # list all cases + commands
plugins/sdd-engineering/evals/run-smoke.sh EVAL-03  # one case
```

Each command loads all four plugins via `--plugin-dir` so cross-plugin
namespacing (`engineering-paved-path:*`, `research-tools:researcher`,
`architecture-review:architecture-reviewer`) resolves exactly as it will
after installation.

## Cases

| Case | Verifies |
|---|---|
| EVAL-01 | spec-creator asks clarifying questions first and writes no implementation details into the spec |
| EVAL-02 | implementation-planner consumes an existing spec instead of re-inventing requirements |
| EVAL-03 | run-plan dispatches sdd-engineering:implementer per the plan |
| EVAL-04 | the review gate calls architecture-review:architecture-reviewer (dependency plugin), honoring NOT-APPLICABLE |
| EVAL-05 | plan-verifier maps ACs to concrete evidence, returns the coverage matrix |
| EVAL-06 | workflow-retro never auto-fires; runs only on explicit request; analyze_journals.py resolves via ${CLAUDE_SKILL_DIR} |
| EVAL-07 | namespaced skill preloads resolve with zero missing-skill warnings; SDD workflow does NOT activate on an irrelevant request |
| EVAL-08 | (1.1.0) spec-creator refuses to finalize a spec while a mandatory requirement lacks an acceptance criterion |
