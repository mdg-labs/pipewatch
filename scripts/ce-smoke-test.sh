#!/usr/bin/env bash
# Smoke-test a running PipeWatch CE Docker Compose stack.
# Usage: bash scripts/ce-smoke-test.sh [API_URL] [WEB_URL]
set -euo pipefail

API_URL="${1:-http://localhost:3000}"
WEB_URL="${2:-http://localhost:3001}"

failures=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-}"

  if ! response="$(curl -fsS --max-time 10 "$url" 2>&1)"; then
    echo "FAIL  $name — $url unreachable"
    echo "      $response"
    failures=$((failures + 1))
    return
  fi

  if [[ -n "$expect" && "$response" != *"$expect"* ]]; then
    echo "FAIL  $name — unexpected response from $url"
    echo "      expected substring: $expect"
    echo "      got: $response"
    failures=$((failures + 1))
    return
  fi

  echo "OK    $name — $url"
}

echo "PipeWatch CE smoke test"
echo "  API: $API_URL"
echo "  Web: $WEB_URL"
echo

check "API health" "$API_URL/health" '"status":"ok"'
check "Web dashboard" "$WEB_URL/" ""

if command -v docker >/dev/null 2>&1 && docker compose ps --status running >/dev/null 2>&1; then
  running="$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null | sort | tr '\n' ' ')"
  for svc in api worker web postgres redis; do
    if [[ "$running" != *"$svc"* ]]; then
      echo "WARN  Compose service '$svc' is not running"
    fi
  done
  echo "OK    Compose services running: $running"
else
  echo "SKIP  docker compose status (docker unavailable or not in compose directory)"
fi

echo
if [[ "$failures" -gt 0 ]]; then
  echo "$failures check(s) failed"
  exit 1
fi

echo "All checks passed"
