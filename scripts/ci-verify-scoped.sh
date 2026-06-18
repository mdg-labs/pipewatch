#!/usr/bin/env bash
# Verifier Layer 2 — scoped lint/typecheck/unit for one Turbo filter cone.
# Requires TURBO_FILTER (e.g. @pipewatch/api...). Parallel-safe with WORK_ROOT set.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${TURBO_FILTER:-}" ]]; then
  echo "ci-verify-scoped: TURBO_FILTER is required (e.g. @pipewatch/api...)" >&2
  exit 1
fi

export WORK_ROOT="${WORK_ROOT:-$ROOT}"
export TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-1}"

bash scripts/ci-preflight.sh

echo "ci-verify-scoped: filter=${TURBO_FILTER}"
pnpm turbo lint --filter="${TURBO_FILTER}"
pnpm turbo typecheck --filter="${TURBO_FILTER}"
pnpm turbo test:unit --filter="${TURBO_FILTER}"

echo "ci-verify-scoped: PASS"
