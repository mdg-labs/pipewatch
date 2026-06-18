#!/usr/bin/env bash
# Deploy a Cloudflare Worker with exponential backoff (PRD §22).
set -euo pipefail

WORKDIR="${1:?Usage: wrangler-deploy-retry.sh <package-dir> [wrangler args...]}"
shift

cd "${WORKDIR}"

for attempt in 1 2 3; do
  if pnpm exec wrangler deploy "$@"; then
    exit 0
  fi
  if [[ "${attempt}" -eq 3 ]]; then
    exit 1
  fi
  sleep_seconds=$((attempt * 10))
  echo "Wrangler deploy failed (attempt ${attempt}). Retrying in ${sleep_seconds}s..."
  sleep "${sleep_seconds}"
done
