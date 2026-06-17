#!/bin/sh
set -eu

# CE: apply pending Drizzle migrations before API start (PRD Decision #36).
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for API startup (migrations)." >&2
  exit 1
fi

cd /app/packages/db
node /app/node_modules/drizzle-kit/bin.cjs migrate --config drizzle.config.ts
cd /app

exec "$@"
