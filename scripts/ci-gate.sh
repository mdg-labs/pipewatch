#!/usr/bin/env bash
# Execution full CI gate — sequential steps with TURBO_CONCURRENCY=1.
# Use CI_PREFLIGHT_MODE=global only on Lane S serial runs (not during Lane P parallel).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export WORK_ROOT="${WORK_ROOT:-$ROOT}"
export TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-1}"

bash scripts/ci-preflight.sh

run() {
  echo "+ $*"
  "$@"
}

run pnpm lint
run pnpm typecheck
run pnpm test:unit
run pnpm build
run pnpm test:integration
run pnpm audit --audit-level=high

echo "ci-gate: PASS"
