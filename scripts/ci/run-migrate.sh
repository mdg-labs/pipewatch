#!/usr/bin/env bash
# Pre-deploy Drizzle migrations — product schema only (PRD §22, Decision #38).
# Uses DATABASE_URL_UNPOOLED (direct connection); runtime apps use pooled DATABASE_URL.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL_UNPOOLED:-}" ]]; then
  echo "run-migrate: DATABASE_URL_UNPOOLED must be set" >&2
  exit 1
fi

export DATABASE_URL="${DATABASE_URL_UNPOOLED}"

echo "run-migrate: applying product Drizzle migrations (unpooled)"
pnpm install --frozen-lockfile
pnpm db:migrate

echo "run-migrate: done"
