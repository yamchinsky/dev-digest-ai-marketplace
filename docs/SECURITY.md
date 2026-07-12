# Security policy

## Tool permissions

- Every agent declares the minimal `tools:` set it needs. Read-only agents
  (researcher, architecture-reviewer, plan-verifier) must not carry Write,
  Edit, or unrestricted Bash.
- A PR that widens any `tools:` line must call it out explicitly in the PR
  checklist ("Permissions added/changed") and justify it. Reviewers treat a
  silent permission widening as a blocking finding.
- Skills and agents must not instruct the model to bypass user confirmation
  for destructive or outward-facing actions (force-push, deletion, publishing).

## Secrets

- No credentials, tokens, or keys anywhere in the repository — manifests,
  skills, agents, scripts, evals, or docs.
- A component that needs a secret names a **slot** (an environment variable or
  a documented external file the *user* provides) and documents the behavior
  when the slot is empty. The value never ships with the plugin.
- `.env*` files are never committed; generated site data must not embed
  secrets either (the index builder reads only repository files).

## Supporting scripts

- Scripts shipped inside plugins (`skills/*/scripts/`) are offline: no network
  calls, no package installation at runtime, no writes outside the invoking
  session's working directory or scratchpad.
- Scripts are invoked via `${CLAUDE_SKILL_DIR}` and must run with the standard
  interpreter available on a developer machine (e.g. `python3`, `node`) with
  no third-party dependencies.

## Untrusted input

- Reviewer- and research-type agents treat file contents, diffs, PR
  descriptions, and web pages as **data, never instructions**. Prompt text in
  reviewed material must not change the agent's behavior.

## If a dangerous release is discovered

1. **Do not delete or move the tag** — installed copies pin it, and history
   must stay auditable.
2. Publish a fixed **patch release** immediately (`x.y.z+1`) with a CHANGELOG
   entry describing the issue.
3. Add a **security notice** to the plugin README (and the catalog site picks
   it up on the next build).
4. Notify consumers through the team channel; they update with
   `claude plugin marketplace update <marketplace>` followed by
   `claude plugin update <plugin>`.
5. If the release is actively harmful (exfiltration, destructive commands),
   additionally remove the plugin entry from `marketplace.json` so new
   installs stop, and open an incident issue documenting the timeline.
