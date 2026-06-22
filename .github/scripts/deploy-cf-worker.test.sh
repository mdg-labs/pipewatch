#!/usr/bin/env bash
# Validates Astro marketing deploy prerequisites (PRD §4.2, §22).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

WRANGLER="${ROOT}/apps/marketing/wrangler.jsonc"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy-cf-worker.sh"

if [[ ! -f "$WRANGLER" ]]; then
  echo "deploy-cf-worker.test: missing ${WRANGLER}" >&2
  exit 1
fi

if ! grep -q '@astrojs/cloudflare/entrypoints/server' "$WRANGLER"; then
  echo "deploy-cf-worker.test: wrangler.jsonc must use Astro dev entrypoint" >&2
  exit 1
fi

if ! grep -q 'dist/server/wrangler.json' "$DEPLOY_SCRIPT"; then
  echo "deploy-cf-worker.test: marketing deploy must use Astro-built dist/server/wrangler.json" >&2
  exit 1
fi

for key in LAUNCH_MODE PUBLIC_APP_URL UMAMI_SCRIPT_URL UMAMI_WEBSITE_ID PIPEWATCH_EDITION; do
  if ! grep -q "${key}" "$DEPLOY_SCRIPT"; then
    echo "deploy-cf-worker.test: deploy script must pass ${key} for marketing build" >&2
    exit 1
  fi
done

if ! grep -q 'wrangler-deploy-retry.sh' "$DEPLOY_SCRIPT"; then
  echo "deploy-cf-worker.test: deploy script must use wrangler-deploy-retry.sh" >&2
  exit 1
fi

if ! grep -q 'Astro build' "$DEPLOY_SCRIPT"; then
  echo "deploy-cf-worker.test: deploy script must run Astro build for marketing" >&2
  exit 1
fi

if awk '/marketing\)/,/\*\)/' "$DEPLOY_SCRIPT" | grep -q 'opennext'; then
  echo "deploy-cf-worker.test: marketing deploy must not use OpenNext" >&2
  exit 1
fi

echo "deploy-cf-worker.test: PASS"
