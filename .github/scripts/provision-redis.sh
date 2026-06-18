#!/usr/bin/env bash
# Ensure the Fly.io Redis app exists and has a running Machine (PRD §4.2).
#
# Idempotent:
#   - Healthy running Machine → skip (never redeploy or destroy existing Redis)
#   - Missing app → flyctl apps create only, then first-time deploy if no Machines
#   - App with zero Machines → first-time deploy (volume-backed, bind ::, port 6379)
#
# IPv6 bind: Fly 6PN (.internal DNS) is IPv6-only. Redis must use --bind :: (or omit
# bind entirely). Binding to 0.0.0.0 alone breaks pipewatch-{staging|prod}-redis.internal.
#
# REDIS_URL is derived in sync-secrets.sh from FLY_REDIS_APP — not set here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=fly-app-helpers.sh
source "${SCRIPT_DIR}/fly-app-helpers.sh"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REDIS_FLY_CONFIG="${ROOT}/.github/infra/redis/fly.toml"
REDIS_VOLUME_NAME="redis_data"

usage() {
  cat <<'EOF'
Usage: provision-redis.sh <staging|production>

Ensures pipewatch-{staging|prod}-redis exists with at least one running Machine.
Respects FLY_ORG and FLY_REGION (default: fra) when creating apps/volumes.
EOF
}

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "provision-redis: FLY_API_TOKEN must be set" >&2
  exit 1
fi

require_fly_org_for_provision

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

GHA_ENV="$1"
INFRA_SLUG="$("$SCRIPT_DIR/infra-slug.sh" "$GHA_ENV")"
FLY_REDIS_APP="$(canonical_fly_app_name "$INFRA_SLUG" redis)"
FLY_REGION="${FLY_REGION:-fra}"

export FLY_REDIS_APP

warn_legacy_fly_app redis "$INFRA_SLUG"

count_machines() {
  local app="$1"
  local -a org_args=()
  with_org_args org_args

  local output
  if ! output="$(flyctl machines list -a "$app" "${org_args[@]}" --json 2>&1)"; then
    if echo "$output" | grep -qi 'could not find app'; then
      echo -1
      return 0
    fi
    echo 0
    return 0
  fi

  echo "$output" | jq 'length' 2>/dev/null || echo 0
}

count_running_machines() {
  local app="$1"
  local total
  total="$(count_machines "$app")"
  if [[ "$total" == -1 ]]; then
    echo -1
    return 0
  fi
  if [[ "$total" == 0 ]]; then
    echo 0
    return 0
  fi

  local -a org_args=()
  with_org_args org_args
  flyctl machines list -a "$app" "${org_args[@]}" --json 2>/dev/null \
    | jq '[.[] | select(.state == "started" or .state == "running")] | length' 2>/dev/null \
    || echo 0
}

ensure_fly_app() {
  if fly_app_exists "$FLY_REDIS_APP"; then
    echo "provision-redis: ${FLY_REDIS_APP} already exists"
    return 0
  fi

  echo "provision-redis: creating ${FLY_REDIS_APP}"
  local -a org_args=()
  with_org_args org_args

  if ! flyctl apps create "$FLY_REDIS_APP" "${org_args[@]}"; then
    echo "provision-redis: failed to create ${FLY_REDIS_APP}" >&2
    exit 1
  fi

  if ! wait_for_fly_app_visible "$FLY_REDIS_APP"; then
    echo "provision-redis: ${FLY_REDIS_APP} not visible after create" >&2
    exit 1
  fi

  echo "provision-redis: ${FLY_REDIS_APP} registered"
}

ensure_redis_volume() {
  local -a org_args=()
  with_org_args org_args

  if ! fly_app_exists "$FLY_REDIS_APP"; then
    echo "provision-redis: ${FLY_REDIS_APP} missing before volume create — registering app"
    ensure_fly_app
  fi

  local existing
  existing="$(flyctl volumes list -a "$FLY_REDIS_APP" "${org_args[@]}" --json 2>/dev/null \
    | jq '[.[] | select(.name == "'"${REDIS_VOLUME_NAME}"'")] | length' 2>/dev/null \
    || echo 0)"

  if [[ "$existing" -ge 1 ]]; then
    echo "provision-redis: volume ${REDIS_VOLUME_NAME} already exists on ${FLY_REDIS_APP}"
    return 0
  fi

  echo "provision-redis: creating volume ${REDIS_VOLUME_NAME} in ${FLY_REGION}"
  local create_output
  if create_output="$(flyctl volumes create "$REDIS_VOLUME_NAME" \
    -a "$FLY_REDIS_APP" \
    "${org_args[@]}" \
    --region "$FLY_REGION" \
    --yes 2>&1)"; then
    return 0
  fi

  if echo "$create_output" | grep -qi 'could not find app'; then
    echo "provision-redis: volume API could not resolve ${FLY_REDIS_APP} — re-registering app and retrying"
    if ! flyctl apps create "$FLY_REDIS_APP" "${org_args[@]}" 2>/dev/null; then
      : # may already exist in another visibility window
    fi
    if ! wait_for_fly_app_visible "$FLY_REDIS_APP"; then
      echo "provision-redis: ${FLY_REDIS_APP} still not visible after retry" >&2
      echo "$create_output" >&2
      exit 1
    fi
    if ! flyctl volumes create "$REDIS_VOLUME_NAME" \
      -a "$FLY_REDIS_APP" \
      "${org_args[@]}" \
      --region "$FLY_REGION" \
      --yes; then
      echo "provision-redis: failed to create volume ${REDIS_VOLUME_NAME} after app retry" >&2
      exit 1
    fi
    return 0
  fi

  echo "provision-redis: failed to create volume ${REDIS_VOLUME_NAME}" >&2
  echo "$create_output" >&2
  exit 1
}

deploy_redis_workload() {
  if [[ ! -f "$REDIS_FLY_CONFIG" ]]; then
    echo "provision-redis: missing Fly config: ${REDIS_FLY_CONFIG}" >&2
    exit 1
  fi

  ensure_redis_volume

  local -a org_args=()
  with_org_args org_args
  local deploy_config
  deploy_config="$(mktemp)"
  # fly.toml app name must match --app or deploy/volume APIs disagree (static file uses placeholder).
  sed "s/^app = .*/app = \"${FLY_REDIS_APP}\"/" "$REDIS_FLY_CONFIG" >"$deploy_config"

  echo "provision-redis: deploying first-time Redis workload to ${FLY_REDIS_APP}"
  if ! flyctl deploy \
    -a "$FLY_REDIS_APP" \
    "${org_args[@]}" \
    --config "$deploy_config" \
    --remote-only \
    --ha=false \
    --yes; then
    rm -f "$deploy_config"
    echo "provision-redis: deploy failed for ${FLY_REDIS_APP}" >&2
    exit 1
  fi

  rm -f "$deploy_config"
  echo "provision-redis: ${FLY_REDIS_APP} deployed"
}

ensure_fly_app

running="$(count_running_machines "$FLY_REDIS_APP")"
if [[ "$running" == -1 ]]; then
  echo "provision-redis: ${FLY_REDIS_APP} not found for machines list — registering app"
  ensure_fly_app
  running="$(count_running_machines "$FLY_REDIS_APP")"
fi
if [[ "$running" -ge 1 ]]; then
  echo "provision-redis: ${FLY_REDIS_APP} healthy (${running} running Machine(s)) — skipping deploy"
  exit 0
fi

total="$(count_machines "$FLY_REDIS_APP")"
if [[ "$total" -ge 1 ]]; then
  echo "provision-redis: ${FLY_REDIS_APP} has ${total} Machine(s) but none running — manual intervention required" >&2
  exit 1
fi

deploy_redis_workload

running="$(count_running_machines "$FLY_REDIS_APP")"
if [[ "$running" -lt 1 ]]; then
  echo "provision-redis: deploy finished but no running Machines on ${FLY_REDIS_APP}" >&2
  exit 1
fi

if ! fly_app_exists "$FLY_REDIS_APP"; then
  echo "provision-redis: verification failed — ${FLY_REDIS_APP} not found in org ${FLY_ORG}" >&2
  exit 1
fi

echo "provision-redis: verified ${FLY_REDIS_APP} in org ${FLY_ORG}"
echo "provision-redis: complete (${GHA_ENV} → ${INFRA_SLUG}, app=${FLY_REDIS_APP})"
