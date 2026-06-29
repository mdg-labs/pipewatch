#!/usr/bin/env bash
# Verifies GH_* → GITHUB_* mapping at the sync boundary (issue #139).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=github-secret-map.sh
source "${SCRIPT_DIR}/github-secret-map.sh"

append_fly_secret() {
  local -n _pairs="$1"
  local key="$2"
  local value="${!key-}"

  if [[ -n "$value" ]]; then
    _pairs+=("${key}=${value}")
  fi
}

export GH_APP_ID="12345"
export GH_APP_PRIVATE_KEY="test-pem"
unset GITHUB_APP_ID GITHUB_APP_PRIVATE_KEY

map_github_storage_to_runtime

if [[ "${GITHUB_APP_ID:-}" != "12345" ]]; then
  echo "sync-secrets.test: expected GITHUB_APP_ID=12345, got ${GITHUB_APP_ID:-<unset>}" >&2
  exit 1
fi

if [[ "${GITHUB_APP_PRIVATE_KEY:-}" != "test-pem" ]]; then
  echo "sync-secrets.test: expected GITHUB_APP_PRIVATE_KEY=test-pem, got ${GITHUB_APP_PRIVATE_KEY:-<unset>}" >&2
  exit 1
fi

pairs=()
append_fly_secret pairs GITHUB_APP_ID

if [[ ${#pairs[@]} -ne 1 || "${pairs[0]}" != "GITHUB_APP_ID=12345" ]]; then
  echo "sync-secrets.test: expected staged Fly pair GITHUB_APP_ID=12345, got ${pairs[*]:-<none>}" >&2
  exit 1
fi

echo "sync-secrets.test: PASS"
