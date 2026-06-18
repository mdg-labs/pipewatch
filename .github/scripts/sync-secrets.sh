#!/usr/bin/env bash
# Push GitHub Actions environment secrets to Fly.io apps and Cloudflare Workers.
# Reads from process env (workflow maps secrets.* → env). No Phase CLI (PRD §10, Decision #33).
#
# FLY_SECRETS_MODE (from workflow):
#   stage-only       — flyctl secrets set --stage; no deploy (workflow_call / deploy chain)
#   stage-and-deploy — flyctl secrets set --stage then flyctl secrets deploy (workflow_dispatch)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<'EOF'
Usage: sync-secrets.sh <staging|production> [services]

services: all (default) | api | worker | web | marketing | comma-separated list

FLY_SECRETS_MODE env:
  stage-only       — stage Fly secrets only (default for deploy pipeline)
  stage-and-deploy — stage then deploy Fly secrets to running Machines
EOF
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

GHA_ENV="$1"
SERVICES="${2:-all}"
FLY_SECRETS_MODE="${FLY_SECRETS_MODE:-stage-only}"

if [[ "$FLY_SECRETS_MODE" != "stage-only" && "$FLY_SECRETS_MODE" != "stage-and-deploy" ]]; then
  echo "sync-secrets: invalid FLY_SECRETS_MODE: ${FLY_SECRETS_MODE} (expected stage-only or stage-and-deploy)" >&2
  exit 1
fi

INFRA_SLUG="$("$SCRIPT_DIR/infra-slug.sh" "$GHA_ENV")"

service_selected() {
  local name="$1"
  [[ "$SERVICES" == "all" ]] && return 0
  [[ ",$SERVICES," == *",$name,"* ]]
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "sync-secrets: missing required command: $1" >&2
    exit 1
  fi
}

append_fly_secret() {
  local -n _pairs="$1"
  local key="$2"
  local value="${!key-}"

  if [[ -n "$value" ]]; then
    _pairs+=("${key}=${value}")
  fi
}

sync_fly_secrets() {
  local app="$1"
  shift
  local -a keys=("$@")
  local -a pairs=()

  for key in "${keys[@]}"; do
    append_fly_secret pairs "$key"
  done

  if [[ ${#pairs[@]} -eq 0 ]]; then
    echo "sync-secrets: no Fly secrets to set for ${app}"
    return 0
  fi

  echo "sync-secrets: staging ${#pairs[@]} secrets on Fly app ${app}"
  flyctl secrets set "${pairs[@]}" --app "$app" --stage

  if [[ "$FLY_SECRETS_MODE" == "stage-and-deploy" ]]; then
    echo "sync-secrets: deploying staged secrets to Fly app ${app}"
    flyctl secrets deploy --app "$app"
  fi
}

sync_wrangler_secret() {
  local worker="$1"
  local key="$2"
  local value="${!key-}"

  if [[ -z "$value" ]]; then
    return 0
  fi

  echo "sync-secrets: syncing ${key} to Cloudflare Worker ${worker}"
  printf '%s' "$value" | wrangler secret put "$key" --name "$worker"
}

require_cmd flyctl
require_cmd wrangler

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "sync-secrets: FLY_API_TOKEN must be set" >&2
  exit 1
fi

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "sync-secrets: CF_API_TOKEN must be set" >&2
  exit 1
fi

export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN}"

API_APP="pipewatch-${INFRA_SLUG}-api"
WORKER_APP="pipewatch-${INFRA_SLUG}-worker"
WEB_WORKER="pipewatch-${INFRA_SLUG}-web"
MARKETING_WORKER="pipewatch-${INFRA_SLUG}-marketing"

API_FLY_KEYS=(
  NODE_ENV
  PIPEWATCH_EDITION
  DATABASE_URL
  REDIS_URL
  ENCRYPTION_KEY
  SENTRY_DSN
  JWT_SECRET
  JWT_REFRESH_SECRET
  GITHUB_APP_ID
  GITHUB_APP_PRIVATE_KEY
  GITHUB_WEBHOOK_SECRET
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  GITHUB_APP_SLUG
  APP_URL
  MARKETING_URL
  SMTP_HOST
  SMTP_PORT
  SMTP_USER
  SMTP_PASS
  SMTP_FROM
  POSTMARK_API_KEY
  POSTMARK_BROADCAST_STREAM
  POSTMARK_WEBHOOK_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_PRO
  STRIPE_PRICE_BUSINESS
  PIPEWATCH_MODE
)

WORKER_FLY_KEYS=(
  NODE_ENV
  PIPEWATCH_EDITION
  DATABASE_URL
  REDIS_URL
  ENCRYPTION_KEY
  SENTRY_DSN
  GITHUB_APP_ID
  GITHUB_APP_PRIVATE_KEY
  PIPEWATCH_MODE
  RETENTION_DAYS
)

WEB_WRANGLER_KEYS=(
  NODE_ENV
  PIPEWATCH_EDITION
  NEXT_PUBLIC_API_URL
  SENTRY_DSN
)

MARKETING_WRANGLER_KEYS=(
  NODE_ENV
  PIPEWATCH_EDITION
  LAUNCH_MODE
  NEXT_PUBLIC_APP_URL
  SENTRY_DSN
  UMAMI_SCRIPT_URL
  UMAMI_WEBSITE_ID
)

echo "sync-secrets: Fly mode ${FLY_SECRETS_MODE}"

if service_selected api; then
  sync_fly_secrets "$API_APP" "${API_FLY_KEYS[@]}"
fi

if service_selected worker; then
  sync_fly_secrets "$WORKER_APP" "${WORKER_FLY_KEYS[@]}"
fi

if service_selected web; then
  for key in "${WEB_WRANGLER_KEYS[@]}"; do
    sync_wrangler_secret "$WEB_WORKER" "$key"
  done
fi

if service_selected marketing; then
  for key in "${MARKETING_WRANGLER_KEYS[@]}"; do
    sync_wrangler_secret "$MARKETING_WORKER" "$key"
  done
fi

echo "sync-secrets: complete (${GHA_ENV} → ${INFRA_SLUG})"
