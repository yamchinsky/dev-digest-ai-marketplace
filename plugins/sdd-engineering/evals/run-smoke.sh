#!/usr/bin/env bash
# Prints the ready-to-run smoke command for each eval case (or one case).
# Usage: run-smoke.sh [EVAL-NN]
set -euo pipefail

EVALS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGINS_DIR="$(cd "$EVALS_DIR/../.." && pwd)"

PLUGIN_FLAGS="--plugin-dir $PLUGINS_DIR/engineering-paved-path \
--plugin-dir $PLUGINS_DIR/research-tools \
--plugin-dir $PLUGINS_DIR/architecture-review \
--plugin-dir $PLUGINS_DIR/sdd-engineering"

filter="${1:-}"

for case_file in "$EVALS_DIR"/cases/EVAL-*.md; do
  name="$(basename "$case_file" .md)"
  if [[ -n "$filter" && "$name" != "$filter"* ]]; then
    continue
  fi
  echo "=============================================================="
  echo "# $name"
  # Print Purpose + Prompt sections so the runner sees what to check.
  awk '/^## (Purpose|Prompt|Pass signals|Fail signals)/{p=1} /^## (Setup)/{p=0} p' "$case_file"
  echo
  echo "Run inside your test project directory:"
  echo
  echo "  claude $PLUGIN_FLAGS"
  echo
  echo "…then paste the Prompt above into the session and judge the signals."
  echo
done
