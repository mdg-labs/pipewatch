#!/usr/bin/env bash
# Pre-deploy admin schema migrations — @pipewatch/db-admin only (PRD §22).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL_UNPOOLED:-}" ]]; then
  echo "run-migrate-admin: DATABASE_URL_UNPOOLED must be set" >&2
  exit 1
fi

export DATABASE_URL="${DATABASE_URL_UNPOOLED}"

echo "run-migrate-admin: applying admin schema migrations"
pnpm install --frozen-lockfile
pnpm --filter @pipewatch/db-admin db:migrate

echo "run-migrate-admin: done"
