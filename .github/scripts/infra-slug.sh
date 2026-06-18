#!/usr/bin/env bash
# Map GitHub Actions environment names to infrastructure resource slugs (PRD §4.3).
# Usage: infra-slug.sh <staging|production>

set -euo pipefail

gha_env="${1:-}"

case "$gha_env" in
  staging)
    echo "staging"
    ;;
  production)
    echo "prod"
    ;;
  *)
    echo "infra-slug: unsupported GHA environment: ${gha_env}" >&2
    exit 1
    ;;
esac
