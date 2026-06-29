#!/usr/bin/env bash
# Smoke-test deploy surfaces (PRD §22):
#   API + Web + Marketing + Worker + Admin — GET /health and /version (JSON, HTTP 200)
#
# Flags (default: all api/web/marketing when no flags):
#   --api        APP_BASE_URL|API_ORIGIN|NEXT_PUBLIC_API_URL /health + /version
#   --web        FRONTEND_ORIGIN|APP_URL /health + /version
#   --marketing  MARKETING_ORIGIN|MARKETING_URL /health + /version
#   --worker     WORKER_PROBE_URL /health + /version
#   --admin      delegates to smoke-admin-health.sh (ADMIN_URL /health + /version)
#
# When CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET are set (GHA environment secrets),
# sends Cloudflare Access service-token headers on every request.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

DO_API=false
DO_WEB=false
DO_MARKETING=false
DO_WORKER=false
DO_ADMIN=false

usage() {
  echo "Usage: $0 [--api] [--web] [--marketing] [--worker] [--admin]" >&2
  echo "  With no flags, runs api, web, and marketing checks." >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api) DO_API=true ;;
    --web) DO_WEB=true ;;
    --marketing) DO_MARKETING=true ;;
    --worker) DO_WORKER=true ;;
    --admin) DO_ADMIN=true ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if ! $DO_API && ! $DO_WEB && ! $DO_MARKETING && ! $DO_WORKER && ! $DO_ADMIN; then
  DO_API=true
  DO_WEB=true
  DO_MARKETING=true
fi

resolve_api_origin() {
  if [[ -n "${APP_BASE_URL:-}" ]]; then
    printf '%s' "${APP_BASE_URL}"
    return
  fi
  if [[ -n "${API_ORIGIN:-}" ]]; then
    printf '%s' "${API_ORIGIN}"
    return
  fi
  printf '%s' "${NEXT_PUBLIC_API_URL:-}"
}

resolve_web_origin() {
  if [[ -n "${FRONTEND_ORIGIN:-}" ]]; then
    printf '%s' "${FRONTEND_ORIGIN}"
    return
  fi
  printf '%s' "${APP_URL:-}"
}

resolve_marketing_origin() {
  if [[ -n "${MARKETING_ORIGIN:-}" ]]; then
    printf '%s' "${MARKETING_ORIGIN}"
    return
  fi
  printf '%s' "${MARKETING_URL:-}"
}

if $DO_API; then
  API_ORIGIN_RESOLVED="$(resolve_api_origin)"
  : "${API_ORIGIN_RESOLVED:?APP_BASE_URL, API_ORIGIN, or NEXT_PUBLIC_API_URL is required for --api}"
fi
if $DO_WEB; then
  WEB_ORIGIN_RESOLVED="$(resolve_web_origin)"
  : "${WEB_ORIGIN_RESOLVED:?FRONTEND_ORIGIN or APP_URL is required for --web}"
fi
if $DO_MARKETING; then
  MARKETING_ORIGIN_RESOLVED="$(resolve_marketing_origin)"
  : "${MARKETING_ORIGIN_RESOLVED:?MARKETING_ORIGIN or MARKETING_URL is required for --marketing}"
fi
if $DO_WORKER; then
  : "${WORKER_PROBE_URL:?WORKER_PROBE_URL is required for --worker}"
fi

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
  curl --connect-timeout 5 --max-time 30 "${CURL_ACCESS_ARGS[@]}" "$@"
}

check_surface() {
  local name="$1"
  local base="$2"
  local health_url="${base%/}/health"
  local version_url="${base%/}/version"
  local tmp_prefix
  tmp_prefix="/tmp/pipewatch-smoke-${name// /-}"

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

  local health_status version_status
  health_status="$(smoke_curl -s -o "${tmp_prefix}-health.json" -w '%{http_code}' "${health_url}")"
  version_status="$(smoke_curl -s -o "${tmp_prefix}-version.json" -w '%{http_code}' "${version_url}")"

  echo "  GET /health -> HTTP ${health_status}"
  cat "${tmp_prefix}-health.json"
  echo ""
  echo "  GET /version -> HTTP ${version_status}"
  cat "${tmp_prefix}-version.json"
  echo ""

  if [[ "${health_status}" != "200" || "${version_status}" != "200" ]]; then
    echo "Smoke failed for ${name}" >&2
    return 1
  fi
}

if $DO_API; then
  check_surface "API" "${API_ORIGIN_RESOLVED}"
fi

if $DO_WEB; then
  check_surface "Web" "${WEB_ORIGIN_RESOLVED}"
fi

if $DO_MARKETING; then
  check_surface "Marketing" "${MARKETING_ORIGIN_RESOLVED}"
fi

if $DO_WORKER; then
  check_surface "Worker" "${WORKER_PROBE_URL}"
fi

if $DO_ADMIN; then
  bash "${SCRIPT_DIR}/smoke-admin-health.sh"
fi

echo "Staging smoke passed"
