#!/usr/bin/env bash
# Shared Fly.io app helpers for provision scripts.
# apps list --json (+ --org) is authoritative; apps show can false-positive on org mismatch.

set -euo pipefail

with_org_args() {
  local -n _out=$1
  _out=()
  if [[ -n "${FLY_ORG:-}" ]]; then
    _out=(--org "$FLY_ORG")
  fi
}

fly_app_exists() {
  local app="$1"
  local -a org_args=()
  with_org_args org_args

  flyctl apps list "${org_args[@]}" --json 2>/dev/null \
    | jq -e --arg name "$app" '.[] | select(.Name == $name or .name == $name)' >/dev/null 2>&1
}

wait_for_fly_app_visible() {
  local app="$1"
  local attempt
  for attempt in 1 2 3 4 5; do
    if fly_app_exists "$app"; then
      return 0
    fi
    echo "fly-app-helpers: waiting for ${app} to appear (attempt ${attempt}/5)"
    sleep 2
  done
  return 1
}

# Pre-PRD §4.3 naming: pipewatch-{api|worker|redis}-{staging|prod}
legacy_fly_app_name() {
  local service="$1"
  local infra_slug="$2"
  echo "pipewatch-${service}-${infra_slug}"
}

# Canonical PRD §4.3 naming: pipewatch-{staging|prod}-{api|worker|redis}
canonical_fly_app_name() {
  local infra_slug="$1"
  local service="$2"
  echo "pipewatch-${infra_slug}-${service}"
}

warn_legacy_fly_app() {
  local service="$1"
  local infra_slug="$2"
  local legacy canonical
  legacy="$(legacy_fly_app_name "$service" "$infra_slug")"
  canonical="$(canonical_fly_app_name "$infra_slug" "$service")"

  if fly_app_exists "$legacy" && ! fly_app_exists "$canonical"; then
    echo "fly-app-helpers: WARNING: legacy app ${legacy} exists; deploy workflows use ${canonical}" >&2
    echo "fly-app-helpers: delete ${legacy} after confirming it is unused (Machines/secrets migrated)" >&2
  fi
}

require_fly_org_for_provision() {
  if [[ -z "${FLY_ORG:-}" ]]; then
    echo "fly-app-helpers: FLY_ORG must be set — provisioning without org causes false \"already exists\" results" >&2
    exit 1
  fi
}
