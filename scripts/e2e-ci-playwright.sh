#!/usr/bin/env bash
# CI Playwright runner — always invokes pnpm test:e2e (never raw Playwright CLI).
#
# Usage:
#   bash scripts/e2e-ci-playwright.sh <cloud|ce> [logfile] [-- playwright args...]
#
# cloud: requires E2E_APP_URL (and optional E2E_API_URL) — staging deployment smoke.
# ce:    ephemeral local stack via test-with-deps + PIPEWATCH_EDITION=ce.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:?mode required: cloud or ce}"
shift

LOG_FILE="rp-e2e-${MODE}.log"
if [[ "${1:-}" != "--" && -n "${1:-}" && "${1:0:1}" != "-" ]]; then
  LOG_FILE="$1"
  shift
fi

if [[ "${1:-}" == "--" ]]; then
  shift
fi

PLAYWRIGHT_ARGS=("$@")

log() {
  printf 'e2e-ci-playwright: %s\n' "$*" >&2
}

run_tests() {
  (
    cd "$ROOT"
    set -o pipefail
    pnpm test:e2e "${PLAYWRIGHT_ARGS[@]}" 2>&1 | tee "$LOG_FILE"
    exit "${PIPESTATUS[0]}"
  )
}

case "$MODE" in
  cloud)
    if [[ -z "${E2E_APP_URL:-}" ]]; then
      log "E2E_APP_URL is required for cloud mode"
      exit 1
    fi
    log "cloud mode — app=${E2E_APP_URL} api=${E2E_API_URL:-<derived>}"
    run_tests
    ;;
  ce)
    export PIPEWATCH_EDITION=ce
    log "ce mode — ephemeral local stack"
    run_tests --project=ce
    ;;
  *)
    log "unknown mode: ${MODE} (expected cloud or ce)"
    exit 1
    ;;
esac
