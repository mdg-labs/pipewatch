#!/usr/bin/env bash
# Build Next.js via OpenNext and deploy to Cloudflare Workers (PRD §4.2).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

APP="${1:-}"
WORKER_NAME="${CF_WORKER_NAME:-}"

if [[ -z "$APP" || -z "$WORKER_NAME" ]]; then
  echo "deploy-cf-worker: usage: CF_WORKER_NAME=<name> deploy-cf-worker.sh <web|marketing>" >&2
  exit 1
fi

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "deploy-cf-worker: CF_API_TOKEN must be set" >&2
  exit 1
fi

if [[ -z "${CF_ACCOUNT_ID:-}" ]]; then
  echo "deploy-cf-worker: CF_ACCOUNT_ID must be set" >&2
  exit 1
fi

export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN}"
export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID}"

case "$APP" in
  web)
    FILTER="@pipewatch/web"
    ;;
  marketing)
    FILTER="@pipewatch/marketing"
    ;;
  *)
    echo "deploy-cf-worker: unsupported app: ${APP}" >&2
    exit 1
    ;;
esac

pnpm install --frozen-lockfile

echo "deploy-cf-worker: building ${FILTER}"
NODE_ENV=production \
  SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}" \
  SENTRY_ORG="${SENTRY_ORG:-}" \
  SENTRY_PROJECT="${SENTRY_PROJECT:-}" \
  SENTRY_RELEASE="${SENTRY_RELEASE:-}" \
  SENTRY_ENVIRONMENT="${SENTRY_ENVIRONMENT:-}" \
  pnpm --filter "$FILTER" build

if pnpm --filter "$FILTER" exec sh -c 'command -v opennextjs-cloudflare >/dev/null 2>&1'; then
  echo "deploy-cf-worker: OpenNext build"
  pnpm --filter "$FILTER" exec opennextjs-cloudflare build
else
  echo "deploy-cf-worker: opennextjs-cloudflare not installed — using next build output"
fi

WRANGLER_CONFIG="apps/${APP}/wrangler.toml"
if [[ ! -f "$WRANGLER_CONFIG" ]]; then
  cat >"$WRANGLER_CONFIG" <<EOF
name = "${WORKER_NAME}"
main = ".open-next/worker.js"
account_id = "${CF_ACCOUNT_ID}"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
EOF
fi

echo "deploy-cf-worker: deploying ${WORKER_NAME}"
pnpm exec wrangler deploy --config "$WRANGLER_CONFIG" --name "$WORKER_NAME"

echo "deploy-cf-worker: ${WORKER_NAME} deployed"
