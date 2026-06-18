#!/usr/bin/env bash
# Integration tests for GitHub Actions (PRD §11, Decision #38).
# Each *.integration.test.ts provisions ephemeral Postgres/Redis via Docker and
# runs its own migrations — no shared GHA service migrate step.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "run-integration-ci: running integration tests"
node scripts/test-integration.mjs
