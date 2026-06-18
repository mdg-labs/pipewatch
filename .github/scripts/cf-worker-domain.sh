#!/usr/bin/env bash
# Map GitHub Actions environment + worker app to PRD §4.3 custom domain hostnames.
# Usage: cf-worker-domain.sh <staging|production> <web|marketing>

set -euo pipefail

GHA_ENV="${1:-}"
APP="${2:-}"

usage() {
  cat <<'EOF'
Usage: cf-worker-domain.sh <staging|production> <web|marketing>

Prints the custom domain hostname for the target CF Worker deploy.
EOF
}

if [[ -z "$GHA_ENV" || -z "$APP" ]]; then
  usage >&2
  exit 1
fi

case "$GHA_ENV" in
  staging)
    case "$APP" in
      web) echo "staging-cloud.pipewatch.app" ;;
      marketing) echo "staging.pipewatch.app" ;;
      *)
        echo "cf-worker-domain: unsupported app for staging: ${APP}" >&2
        exit 1
        ;;
    esac
    ;;
  production)
    case "$APP" in
      web) echo "cloud.pipewatch.app" ;;
      marketing) echo "pipewatch.app" ;;
      *)
        echo "cf-worker-domain: unsupported app for production: ${APP}" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "cf-worker-domain: unsupported GHA environment: ${GHA_ENV}" >&2
    exit 1
    ;;
esac
