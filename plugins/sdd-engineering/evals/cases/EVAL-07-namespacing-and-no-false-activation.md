# EVAL-07 — namespaced preloads resolve; no false SDD activation

## Purpose
Two independent checks of the plugin wiring: (a) the implementer's
namespaced skill preloads (`engineering-paved-path:typescript-expert`,
`engineering-paved-path:security`) resolve with zero missing-skill warnings;
(b) the SDD workflow does not activate on an unrelated request.

## Setup
Any project. Load all four plugins.

## Prompt
> (a) Use the sdd-engineering:implementer agent on a trivial one-file task
> (e.g. "create docs/hello.md with the text 'hello'; owned paths:
> docs/hello.md; no verify command in the plan").
> (b) In a fresh session: "поясни різницю між let і const у JavaScript".

## Pass signals
- (a) The implementer session shows no "missing skill" / "unknown skill"
  warnings; its report names the preloaded skills; with no test command in
  the project it states "no test command found; typecheck-only" (or the
  no-verify statement) instead of failing or inventing commands.
- (b) The answer is a plain explanation — no spec-creator interview, no
  plan, no run-plan activation, no SDD terminology.

## Fail signals
- Any missing-skill warning naming `engineering-paved-path:*` or bare-name
  skill resolution errors.
- The implementer fails or fabricates a verify command in the absence of one.
- The unrelated JS question triggers any part of the SDD workflow.
