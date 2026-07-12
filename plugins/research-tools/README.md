# research-tools

A single generic, read-only research agent: `research-tools:researcher`.

Delegate lookups to it — either inside the current repository (find code,
trace where something lives, check whether something exists; every finding
carries a `path:line` reference) or on the web (docs, releases, API behavior;
every claim carries its source URL). It reports in a strict comparable
structure, states a confidence level, says honestly when nothing was found,
and asks clarifying questions instead of guessing when the request is
ambiguous.

## Install

```bash
claude plugin install research-tools@dev-digest-ai-marketplace
```

Usually you don't install it directly — it arrives automatically as a
dependency of `sdd-engineering`, whose workflow delegates discovery to
`research-tools:researcher`.

## Guarantees

- **Read-only**: no Write/Edit tools; Bash restricted to inspection commands.
- **No fabrication**: unverified facts are never asserted; "not found" is an
  explicit report section.
- **Bounded**: no multi-stage deep-research loops — focused lookups only.

## Inputs

A research question; optionally an explicit mode (project / internet) and
scope hints. With no clear question, the agent returns a clarification block
instead of a report.

## Dependencies

None.
