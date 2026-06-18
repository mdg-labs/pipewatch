#!/usr/bin/env bash
# Push GitHub Actions environment secrets to Fly.io apps and Cloudflare Workers.
# Reads from process env (workflow maps secrets.* → env). No Phase CLI (PRD §10, Decision #33).
#
# FLY_SECRETS_MODE (from workflow):
#   stage-only       — flyctl secrets set --stage; no deploy (workflow_call / deploy chain)
#   stage-and-deploy — flyctl secrets set --stage then flyctl secrets deploy (workflow_dispatch)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=github-secret-map.sh
source "${SCRIPT_DIR}/github-secret-map.sh"

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

map_github_storage_to_runtime

# Required GHA storage keys per service — must match packages/config/sync-secrets-manifest.ts
# (validated by scripts/validate-sync-secrets-manifest.ts in CI).
preflight_required_gha_keys() {
  local service="$1"
  local edition="${PIPEWATCH_EDITION:-cloud}"
  local -a keys=()
  local -a missing=()

  case "$service" in
    api)
      keys=(
        DATABASE_URL
        ENCRYPTION_KEY
        JWT_SECRET
        JWT_REFRESH_SECRET
        GH_APP_ID
        GH_APP_PRIVATE_KEY
        GH_WEBHOOK_SECRET
        GH_CLIENT_ID
        GH_CLIENT_SECRET
        GH_APP_SLUG
        APP_URL
        MARKETING_URL
      )
      if [[ "$edition" == "cloud" ]]; then
        keys+=(
          POSTMARK_WEBHOOK_SECRET
          STRIPE_SECRET_KEY
          STRIPE_WEBHOOK_SECRET
          STRIPE_PRICE_PRO
          STRIPE_PRICE_BUSINESS
        )
      fi
      ;;
    worker)
      keys=(
        DATABASE_URL
        ENCRYPTION_KEY
        GH_APP_ID
        GH_APP_PRIVATE_KEY
      )
      ;;
    web)
      keys=(NEXT_PUBLIC_API_URL)
      ;;
    marketing)
      keys=()
      if [[ "$edition" == "cloud" ]]; then
        keys=(UMAMI_SCRIPT_URL UMAMI_WEBSITE_ID)
      fi
      ;;
    *)
      echo "sync-secrets: unknown service for preflight: ${service}" >&2
      exit 1
      ;;
  esac

  for key in "${keys[@]}"; do
    if [[ -z "${!key-}" ]]; then
      missing+=("$key")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "sync-secrets: missing required GHA secrets for ${service}: ${missing[*]}" >&2
    exit 1
  fi
}

run_service_preflight() {
  local service="$1"
  if service_selected "$service"; then
    preflight_required_gha_keys "$service"
  fi
}

API_APP="pipewatch-${INFRA_SLUG}-api"
WORKER_APP="pipewatch-${INFRA_SLUG}-worker"
REDIS_APP="pipewatch-${INFRA_SLUG}-redis"
WEB_WORKER="pipewatch-${INFRA_SLUG}-web"
MARKETING_WORKER="pipewatch-${INFRA_SLUG}-marketing"

# Internal Fly 6PN — not a Phase/GHA secret (PRD §4.3, Decision #13).
export REDIS_URL="redis://${REDIS_APP}.internal:6379"
echo "sync-secrets: derived REDIS_URL from Fly app name (${REDIS_APP}.internal:6379)"

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

run_service_preflight api
run_service_preflight worker
run_service_preflight web
run_service_preflight marketing

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
