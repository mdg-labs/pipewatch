#!/usr/bin/env bash
# Playwright E2E wrapper — ephemeral local stack or remote staging target (PRD §11).
#
# Usage:
#   bash scripts/test-e2e.sh [playwright args...]
#
# Local (default): Postgres + Redis via test-with-deps.sh, API + web on random ports.
# Staging: set E2E_APP_URL (+ optional E2E_API_URL) to run against a deployed environment.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log() {
  printf 'test-e2e: %s\n' "$*" >&2
}

if [[ -n "${E2E_APP_URL:-}" ]]; then
  log "staging target: ${E2E_APP_URL}"
  if [[ -z "${E2E_API_URL:-}" ]]; then
    if [[ "${E2E_APP_URL}" == *"staging-cloud.pipewatch.app"* ]]; then
      export E2E_API_URL="https://staging-api.pipewatch.app"
    else
      export E2E_API_URL="${E2E_APP_URL}"
    fi
  fi
  log "API target: ${E2E_API_URL}"
  (
    cd "$ROOT"
    pnpm exec playwright install chromium
    pnpm exec playwright test --config e2e/playwright.config.ts "$@"
  )
  exit $?
fi

log "local ephemeral stack (edition=${PIPEWATCH_EDITION:-cloud})"

(
  cd "$ROOT"
  pnpm exec playwright install chromium
)

bash "$ROOT/scripts/test-with-deps.sh" bash "$ROOT/scripts/test-e2e-local.sh" "$@"
