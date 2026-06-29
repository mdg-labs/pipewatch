#!/usr/bin/env bash
# Verifies PRD §4.3 custom domain mapping for CF Worker deploys.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

assert_domain() {
  local gha_env="$1"
  local app="$2"
  local expected="$3"
  local actual

  actual="$("$SCRIPT_DIR/cf-worker-domain.sh" "$gha_env" "$app")"
  if [[ "$actual" != "$expected" ]]; then
    echo "cf-worker-domain.test: expected ${gha_env}/${app} -> ${expected}, got ${actual}" >&2
    exit 1
  fi
}

assert_domain staging web "staging-cloud.pipewatch.app"
assert_domain staging marketing "staging.pipewatch.app"
assert_domain production web "cloud.pipewatch.app"
assert_domain production marketing "pipewatch.app"

echo "cf-worker-domain.test: PASS"
