#!/bin/sh
set -eu

# CE: apply pending Drizzle migrations before API start (PRD Decision #36).
# Cloud runs migrations in CI via run-migrate.sh before deploy (PRD §22).
if [ "${PIPEWATCH_EDITION:-ce}" = "ce" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL is required for CE API startup (migrations)." >&2
    exit 1
  fi

  cd /app/packages/db
  node node_modules/.bin/drizzle-kit migrate --config drizzle.config.ts
  cd /app
fi

exec "$@"
