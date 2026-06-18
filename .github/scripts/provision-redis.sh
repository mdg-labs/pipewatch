#!/usr/bin/env bash
# Ensure the Fly.io Redis app exists for the target environment (PRD §4.2).
# Idempotent — skips create when the app is already registered.

set -euo pipefail

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "provision-redis: FLY_API_TOKEN must be set" >&2
  exit 1
fi

if [[ -z "${FLY_REDIS_APP:-}" ]]; then
  echo "provision-redis: FLY_REDIS_APP must be set" >&2
  exit 1
fi

if flyctl apps show "$FLY_REDIS_APP" >/dev/null 2>&1; then
  echo "provision-redis: ${FLY_REDIS_APP} already exists"
  exit 0
fi

echo "provision-redis: creating ${FLY_REDIS_APP}"
create_args=("$FLY_REDIS_APP")
if [[ -n "${FLY_ORG:-}" ]]; then
  create_args+=(--org "$FLY_ORG")
fi

if ! flyctl apps create "${create_args[@]}"; then
  echo "provision-redis: failed to create ${FLY_REDIS_APP}" >&2
  exit 1
fi

echo "provision-redis: ${FLY_REDIS_APP} registered (deploy Redis workload separately if needed)"
