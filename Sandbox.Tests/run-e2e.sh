#!/bin/sh
# The container's entrypoint: run the suite, then copy what it wrote to
# Sandbox.Tests/results.
#
# Playwright records a trace for every test and deletes it when the test
# passes. Doing that straight onto a folder mounted from Windows made a
# 25 second run take 100 seconds, so the run writes to the container's own
# disk and the results are copied out once, at the end.
#
# Arguments are passed to "playwright test": a spec name, --grep, --repeat-each.
set -u
cd "$(dirname "$0")" || exit 1

scratch=/tmp/e2e-results
results=./results

RESULTS_DIR="$scratch" npx playwright test --config ../Sandbox.Web/playwright.config.ts "$@"
status=$?

# Replace the last run's output, and leave results/.gitignore alone.
mkdir -p "$results"
rm -rf "$results/artifacts" "$results/html-report"
if [ -d "$scratch" ]; then
  cp -r "$scratch/." "$results/"
  echo "Results copied from $scratch to Sandbox.Tests/results."
fi

exit "$status"
