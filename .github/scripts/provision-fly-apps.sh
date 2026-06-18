#!/usr/bin/env bash
# Ensure Fly.io api and worker apps exist for the target environment (PRD §4.2).
# Idempotent — skips create when canonical apps are already registered.
# App shell only — no Machine deploy (deploy workflows unchanged).
#
# Legacy apps (pipewatch-{api|worker}-{staging|prod}) are detected and warned;
# canonical names (pipewatch-{staging|prod}-{api|worker}) are always ensured.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=fly-app-helpers.sh
source "${SCRIPT_DIR}/fly-app-helpers.sh"

usage() {
  cat <<'EOF'
Usage: provision-fly-apps.sh <staging|production>

Creates pipewatch-{staging|prod}-{api|worker} when missing.
Requires FLY_ORG. Does not deploy Machines.
EOF
}

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "provision-fly-apps: FLY_API_TOKEN must be set" >&2
  exit 1
fi

require_fly_org_for_provision

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

GHA_ENV="$1"
INFRA_SLUG="$("$SCRIPT_DIR/infra-slug.sh" "$GHA_ENV")"

API_APP="$(canonical_fly_app_name "$INFRA_SLUG" api)"
WORKER_APP="$(canonical_fly_app_name "$INFRA_SLUG" worker)"

warn_legacy_fly_app api "$INFRA_SLUG"
warn_legacy_fly_app worker "$INFRA_SLUG"

ensure_fly_app() {
  local app="$1"

  if fly_app_exists "$app"; then
    echo "provision-fly-apps: ${app} already exists"
    return 0
  fi

  echo "provision-fly-apps: creating ${app}"
  local -a org_args=()
  with_org_args org_args

  if ! flyctl apps create "$app" "${org_args[@]}"; then
    echo "provision-fly-apps: failed to create ${app}" >&2
    exit 1
  fi

  if ! wait_for_fly_app_visible "$app"; then
    echo "provision-fly-apps: ${app} not visible after create" >&2
    exit 1
  fi

  echo "provision-fly-apps: ${app} registered (deploy workload separately)"
}

ensure_fly_app "$API_APP"
ensure_fly_app "$WORKER_APP"

for app in "$API_APP" "$WORKER_APP"; do
  if ! fly_app_exists "$app"; then
    echo "provision-fly-apps: verification failed — ${app} not found in org ${FLY_ORG}" >&2
    exit 1
  fi
done

echo "provision-fly-apps: verified ${API_APP} and ${WORKER_APP} in org ${FLY_ORG}"
echo "provision-fly-apps: complete (${GHA_ENV} → ${INFRA_SLUG})"
