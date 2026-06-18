#!/usr/bin/env bash
# Build and deploy a PipeWatch service to Fly.io using the app Dockerfile.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SERVICE="${1:-}"
FLY_APP="${FLY_APP:-}"

if [[ -z "$SERVICE" || -z "$FLY_APP" ]]; then
  echo "deploy-fly: usage: FLY_APP=<name> deploy-fly.sh <api|worker>" >&2
  exit 1
fi

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "deploy-fly: FLY_API_TOKEN must be set" >&2
  exit 1
fi

case "$SERVICE" in
  api)
    FLY_CONFIG="${ROOT}/.github/infra/api/fly.toml"
    ;;
  worker)
    FLY_CONFIG="${ROOT}/.github/infra/worker/fly.toml"
    ;;
  *)
    echo "deploy-fly: unsupported service: ${SERVICE}" >&2
    exit 1
    ;;
esac

if [[ ! -f "$FLY_CONFIG" ]]; then
  echo "deploy-fly: missing Fly config: ${FLY_CONFIG}" >&2
  exit 1
fi

deploy_config="$(mktemp)"
# fly.toml app name must match --app or deploy APIs disagree (static file uses placeholder).
sed "s/^app = .*/app = \"${FLY_APP}\"/" "$FLY_CONFIG" >"$deploy_config"
trap 'rm -f "$deploy_config"' EXIT

echo "deploy-fly: deploying ${SERVICE} to ${FLY_APP}"
flyctl deploy \
  --app "$FLY_APP" \
  --config "$deploy_config" \
  --remote-only \
  --ha=false \
  --yes

echo "deploy-fly: ${FLY_APP} deployed"
