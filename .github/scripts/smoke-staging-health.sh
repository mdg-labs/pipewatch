#!/usr/bin/env bash
# Smoke-test staging deploys (PRD §22):
#   API + Web — GET /health (JSON, HTTP 200)
#   Marketing — GET site root / only (HTTP 200)
# When CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET are set, sends Cloudflare Access
# service-token headers on every request (staging Workers may sit behind Access).
set -euo pipefail

: "${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL is required}"
: "${APP_URL:?APP_URL is required}"
: "${MARKETING_URL:?MARKETING_URL is required}"

MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SMOKE_SLEEP_SECONDS:-10}"

CURL_ACCESS_ARGS=()
if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  CURL_ACCESS_ARGS=(
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  )
  echo "Smoke: using Cloudflare Access service token headers"
fi

smoke_curl() {
  curl "${CURL_ACCESS_ARGS[@]}" "$@"
}

check_health_surface() {
  local name="$1"
  local base="$2"
  local health_url="${base%/}/health"

  echo "Smoke: ${name} (${base})"

  local attempt=1
  while [[ "${attempt}" -le "${MAX_ATTEMPTS}" ]]; do
    if smoke_curl -fsS "${health_url}" >/dev/null 2>&1; then
      break
    fi
    if [[ "${attempt}" -eq "${MAX_ATTEMPTS}" ]]; then
      echo "Timed out waiting for ${health_url}" >&2
      return 1
    fi
    echo "  waiting for ${health_url} (attempt ${attempt}/${MAX_ATTEMPTS})..."
    sleep "${SLEEP_SECONDS}"
    attempt=$((attempt + 1))
  done

  local health_status
  health_status="$(smoke_curl -s -o /tmp/pipewatch-smoke-health.json -w '%{http_code}' "${health_url}")"

  echo "  GET /health -> HTTP ${health_status}"
  cat /tmp/pipewatch-smoke-health.json
  echo ""

  if [[ "${health_status}" != "200" ]]; then
    echo "Smoke failed for ${name}" >&2
    return 1
  fi
}

check_marketing_root() {
  local base="$1"
  local root_url="${base%/}/"

  echo "Smoke: Marketing (${base}) — site root liveness"

  local attempt=1
  local root_status=""
  while [[ "${attempt}" -le "${MAX_ATTEMPTS}" ]]; do
    root_status="$(smoke_curl -s -o /dev/null -w '%{http_code}' "${root_url}")"
    if [[ "${root_status}" == "200" ]]; then
      break
    fi
    if [[ "${attempt}" -eq "${MAX_ATTEMPTS}" ]]; then
      echo "Timed out waiting for ${root_url} (last HTTP ${root_status})" >&2
      return 1
    fi
    echo "  waiting for ${root_url} (attempt ${attempt}/${MAX_ATTEMPTS}, last HTTP ${root_status})..."
    sleep "${SLEEP_SECONDS}"
    attempt=$((attempt + 1))
  done

  root_status="$(smoke_curl -s -o /tmp/pipewatch-smoke-marketing-root.html -w '%{http_code}' "${root_url}")"
  echo "  GET / -> HTTP ${root_status}"

  if [[ "${root_status}" != "200" ]]; then
    echo "Smoke failed for Marketing" >&2
    return 1
  fi
}

check_health_surface "API" "${NEXT_PUBLIC_API_URL}"
check_health_surface "Web" "${APP_URL}"
check_marketing_root "${MARKETING_URL}"

echo "Staging smoke passed"
