#!/usr/bin/env bash
# Build Next.js via OpenNext and deploy to Cloudflare Workers (PRD §4.2).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$ROOT"

APP="${1:-}"
WORKER_NAME="${CF_WORKER_NAME:-}"
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-}"
WRANGLER_TEMPLATE="${ROOT}/.github/infra/cf-worker/wrangler.toml"

if [[ -z "$APP" || -z "$WORKER_NAME" || -z "$DEPLOY_ENVIRONMENT" ]]; then
  echo "deploy-cf-worker: usage: DEPLOY_ENVIRONMENT=<staging|production> CF_WORKER_NAME=<name> deploy-cf-worker.sh <web|marketing>" >&2
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

if [[ ! -f "$WRANGLER_TEMPLATE" ]]; then
  echo "deploy-cf-worker: missing Wrangler template: ${WRANGLER_TEMPLATE}" >&2
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

CUSTOM_DOMAIN="$("$SCRIPT_DIR/cf-worker-domain.sh" "$DEPLOY_ENVIRONMENT" "$APP")"
APP_DIR="${ROOT}/apps/${APP}"

pnpm install --frozen-lockfile

echo "deploy-cf-worker: building ${FILTER} workspace dependencies"
NODE_ENV=production \
  SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}" \
  SENTRY_ORG="${SENTRY_ORG:-}" \
  SENTRY_PROJECT="${SENTRY_PROJECT:-}" \
  SENTRY_RELEASE="${SENTRY_RELEASE:-}" \
  SENTRY_ENVIRONMENT="${SENTRY_ENVIRONMENT:-}" \
  pnpm exec turbo run build --filter="${FILTER}^..."

echo "deploy-cf-worker: OpenNext build for ${FILTER}"
(
  cd "$APP_DIR"
  NODE_ENV=production \
    SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}" \
    SENTRY_ORG="${SENTRY_ORG:-}" \
    SENTRY_PROJECT="${SENTRY_PROJECT:-}" \
    SENTRY_RELEASE="${SENTRY_RELEASE:-}" \
    SENTRY_ENVIRONMENT="${SENTRY_ENVIRONMENT:-}" \
    SKIP_WRANGLER_CONFIG_CHECK=yes \
    pnpm exec opennextjs-cloudflare build
)

if [[ ! -f "${APP_DIR}/.open-next/worker.js" ]]; then
  echo "deploy-cf-worker: missing ${APP_DIR}/.open-next/worker.js after OpenNext build" >&2
  exit 1
fi

deploy_config="$(mktemp "${APP_DIR}/.wrangler-deploy.XXXXXX.toml")"
trap 'rm -f "$deploy_config"' EXIT

sed \
  -e "s/__WORKER_NAME__/${WORKER_NAME}/g" \
  -e "s/__ACCOUNT_ID__/${CF_ACCOUNT_ID}/g" \
  -e "s/__CUSTOM_DOMAIN__/${CUSTOM_DOMAIN}/g" \
  "$WRANGLER_TEMPLATE" >"$deploy_config"

echo "deploy-cf-worker: deploying ${WORKER_NAME} at https://${CUSTOM_DOMAIN}"
(
  cd "$APP_DIR"
  pnpm exec wrangler deploy --config "$deploy_config"
)

echo "deploy-cf-worker: ${WORKER_NAME} deployed"
