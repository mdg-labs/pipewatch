#!/usr/bin/env bash
# Ensure Fly.io api and worker apps exist for the target environment (PRD §4.2).
# Idempotent — skips create when apps are already registered.
# App shell only — no Machine deploy (deploy workflows unchanged).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<'EOF'
Usage: provision-fly-apps.sh <staging|production>

Creates pipewatch-{staging|prod}-{api|worker} when missing.
Respects FLY_ORG when set. Does not deploy Machines.
EOF
}

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "provision-fly-apps: FLY_API_TOKEN must be set" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

GHA_ENV="$1"
INFRA_SLUG="$("$SCRIPT_DIR/infra-slug.sh" "$GHA_ENV")"

API_APP="pipewatch-${INFRA_SLUG}-api"
WORKER_APP="pipewatch-${INFRA_SLUG}-worker"

ensure_fly_app() {
  local app="$1"

  if flyctl apps show "$app" >/dev/null 2>&1; then
    echo "provision-fly-apps: ${app} already exists"
    return 0
  fi

  echo "provision-fly-apps: creating ${app}"
  local -a create_args=("$app")
  if [[ -n "${FLY_ORG:-}" ]]; then
    create_args+=(--org "$FLY_ORG")
  fi

  if ! flyctl apps create "${create_args[@]}"; then
    echo "provision-fly-apps: failed to create ${app}" >&2
    exit 1
  fi

  echo "provision-fly-apps: ${app} registered (deploy workload separately)"
}

ensure_fly_app "$API_APP"
ensure_fly_app "$WORKER_APP"

echo "provision-fly-apps: complete (${GHA_ENV} → ${INFRA_SLUG})"
