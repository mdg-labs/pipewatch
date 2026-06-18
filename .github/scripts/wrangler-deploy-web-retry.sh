#!/usr/bin/env bash
# Deploy the OpenNext web worker to Cloudflare with exponential backoff (PRD §22).
# Requires an OpenNext build output wrangler config — default .open-next/wrangler.json.
set -euo pipefail

package_dir="${1:?Usage: wrangler-deploy-web-retry.sh <package-dir> [wrangler-config]}"
config="${2:-.open-next/wrangler.json}"

cd "${package_dir}"

if [[ ! -f "${config}" ]]; then
  echo "Missing ${config}. Run the OpenNext build before deploying the web worker." >&2
  exit 1
fi

for attempt in 1 2 3; do
  if pnpm exec wrangler deploy --config "${config}"; then
    exit 0
  fi
  if [[ "${attempt}" -eq 3 ]]; then
    exit 1
  fi
  sleep_seconds=$((attempt * 10))
  echo "Web worker deploy failed (attempt ${attempt}). Retrying in ${sleep_seconds}s..."
  sleep "${sleep_seconds}"
done
