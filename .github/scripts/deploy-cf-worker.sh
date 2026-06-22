#!/usr/bin/env bash
# Build and deploy Cloudflare Workers apps (web: OpenNext, marketing: Astro) — PRD §4.2.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$ROOT"

APP="${1:-}"
WORKER_NAME="${CF_WORKER_NAME:-}"
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-}"
WEB_WRANGLER_TEMPLATE="${ROOT}/.github/infra/cf-worker/wrangler.toml"

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

export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN}"
export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID}"

case "$APP" in
  web)
    FILTER="@pipewatch/web"
    if [[ -z "${NEXT_PUBLIC_API_URL:-}" ]]; then
      echo "deploy-cf-worker: NEXT_PUBLIC_API_URL must be set for web deploy" >&2
      exit 1
    fi
    if [[ ! -f "$WEB_WRANGLER_TEMPLATE" ]]; then
      echo "deploy-cf-worker: missing Wrangler template: ${WEB_WRANGLER_TEMPLATE}" >&2
      exit 1
    fi
    ;;
  marketing)
    FILTER="@pipewatch/marketing"
    if [[ "${PIPEWATCH_EDITION:-cloud}" == "cloud" ]]; then
      if [[ -z "${UMAMI_SCRIPT_URL:-}" || -z "${UMAMI_WEBSITE_ID:-}" ]]; then
        echo "deploy-cf-worker: UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID must be set for cloud marketing deploy" >&2
        exit 1
      fi
    fi
    ;;
  *)
    echo "deploy-cf-worker: unsupported app: ${APP}" >&2
    exit 1
    ;;
esac

WEB_BUILD_ENV=(
  NODE_ENV=production
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}"
  PIPEWATCH_EDITION="${PIPEWATCH_EDITION:-cloud}"
  SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}"
  SENTRY_ORG="${SENTRY_ORG:-}"
  SENTRY_PROJECT="${SENTRY_PROJECT:-}"
  SENTRY_RELEASE="${SENTRY_RELEASE:-}"
  SENTRY_ENVIRONMENT="${SENTRY_ENVIRONMENT:-}"
)

MARKETING_BUILD_ENV=(
  NODE_ENV=production
  PIPEWATCH_EDITION="${PIPEWATCH_EDITION:-cloud}"
  LAUNCH_MODE="${LAUNCH_MODE:-waitlist}"
  PUBLIC_APP_URL="${PUBLIC_APP_URL:-}"
  UMAMI_SCRIPT_URL="${UMAMI_SCRIPT_URL:-}"
  UMAMI_WEBSITE_ID="${UMAMI_WEBSITE_ID:-}"
)

if [[ "$APP" == "web" ]]; then
  BUILD_ENV=("${WEB_BUILD_ENV[@]}")
else
  BUILD_ENV=("${MARKETING_BUILD_ENV[@]}")
fi

CUSTOM_DOMAIN="$("$SCRIPT_DIR/cf-worker-domain.sh" "$DEPLOY_ENVIRONMENT" "$APP")"
APP_DIR="${ROOT}/apps/${APP}"

pnpm install --frozen-lockfile

echo "deploy-cf-worker: building ${FILTER} workspace dependencies"
env "${BUILD_ENV[@]}" pnpm exec turbo run build --filter="${FILTER}^..."

if [[ "$APP" == "web" ]]; then
  echo "deploy-cf-worker: OpenNext build for ${FILTER}"
  (
    cd "$APP_DIR"
    env "${BUILD_ENV[@]}" SKIP_WRANGLER_CONFIG_CHECK=yes \
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
    "$WEB_WRANGLER_TEMPLATE" >"$deploy_config"
else
  echo "deploy-cf-worker: Astro build for ${FILTER}"
  env "${BUILD_ENV[@]}" pnpm exec turbo run build --filter="${FILTER}"

  if [[ ! -d "${APP_DIR}/dist" ]]; then
    echo "deploy-cf-worker: missing ${APP_DIR}/dist after Astro build" >&2
    exit 1
  fi

  MARKETING_WRANGLER_TEMPLATE="${APP_DIR}/wrangler.jsonc"
  if [[ ! -f "$MARKETING_WRANGLER_TEMPLATE" ]]; then
    echo "deploy-cf-worker: missing Wrangler config: ${MARKETING_WRANGLER_TEMPLATE}" >&2
    exit 1
  fi

  deploy_config="$(mktemp "${APP_DIR}/.wrangler-deploy.XXXXXX.jsonc")"
  trap 'rm -f "$deploy_config"' EXIT

  sed \
    -e "s/\"name\": \"[^\"]*\"/\"name\": \"${WORKER_NAME}\"/g" \
    -e "s/\"account_id\": \"[^\"]*\"/\"account_id\": \"${CF_ACCOUNT_ID}\"/g" \
    "$MARKETING_WRANGLER_TEMPLATE" >"$deploy_config"

  # Inject custom domain route at deploy time.
  node -e "
    const fs = require('node:fs');
    const configPath = process.argv[1];
    const domain = process.argv[2];
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw.replace(/\/\/.*$/gm, ''));
    config.routes = [{ pattern: domain, custom_domain: true }];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  " "$deploy_config" "$CUSTOM_DOMAIN"
fi

echo "deploy-cf-worker: deploying ${WORKER_NAME} at https://${CUSTOM_DOMAIN}"
bash "${SCRIPT_DIR}/wrangler-deploy-retry.sh" "$APP_DIR" --config "$deploy_config"

echo "deploy-cf-worker: ${WORKER_NAME} deployed"
