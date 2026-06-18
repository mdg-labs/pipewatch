#!/usr/bin/env bash
# Integration tests for GitHub Actions — uses GHA service containers (PRD §11, Decision #38).
# Requires DATABASE_URL and REDIS_URL (set by the workflow; never from Neon or Phase).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" || -z "${REDIS_URL:-}" ]]; then
  echo "run-integration-ci: DATABASE_URL and REDIS_URL must be set" >&2
  exit 1
fi

if [[ "${DATABASE_URL}" == *neon* ]] || [[ "${DATABASE_URL}" == *NEON* ]]; then
  echo "run-integration-ci: Neon DATABASE_URL is forbidden in CI (Decision #38)" >&2
  exit 1
fi

echo "run-integration-ci: running Drizzle migrations"
pnpm db:migrate

echo "run-integration-ci: running integration tests"
node scripts/test-integration.mjs
