#!/usr/bin/env bash
# Smoke-test admin portal deploy (PRD §22):
#   GET ${ADMIN_URL}/health and /version (HTTP 200, JSON)
#   GET ${ADMIN_URL}/login (HTTP 200, text/html — RR7 operator UI shell)
# Invoked directly from deploy.yml or via smoke-staging-health.sh --admin.
# When CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET are set, sends Cloudflare Access headers.
set -euo pipefail

: "${ADMIN_URL:?ADMIN_URL is required}"

MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-30}"
SLEEP_SECONDS="${SMOKE_SLEEP_SECONDS:-10}"

CURL_ACCESS_ARGS=()
if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  CURL_ACCESS_ARGS=(
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  )
  echo "Smoke admin: using Cloudflare Access service token headers"
fi

smoke_curl() {
  curl --connect-timeout 5 --max-time 30 "${CURL_ACCESS_ARGS[@]}" "$@"
}

health_url="${ADMIN_URL%/}/health"
version_url="${ADMIN_URL%/}/version"
ui_url="${ADMIN_URL%/}/login"

echo "Smoke admin: ${ADMIN_URL}"

attempt=1
while [[ "${attempt}" -le "${MAX_ATTEMPTS}" ]]; do
  if smoke_curl -fsS "${health_url}" >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" -eq "${MAX_ATTEMPTS}" ]]; then
    echo "Timed out waiting for ${health_url}" >&2
    exit 1
  fi
  echo "  waiting for ${health_url} (attempt ${attempt}/${MAX_ATTEMPTS})..."
  sleep "${SLEEP_SECONDS}"
  attempt=$((attempt + 1))
done

health_status="$(smoke_curl -s -o /tmp/pipewatch-smoke-admin-health.json -w '%{http_code}' "${health_url}")"
version_status="$(smoke_curl -s -o /tmp/pipewatch-smoke-admin-version.json -w '%{http_code}' "${version_url}")"
ui_status="$(smoke_curl -s -o /tmp/pipewatch-smoke-admin-ui.html -w '%{http_code}' "${ui_url}")"
ui_content_type="$(smoke_curl -sI "${ui_url}" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print tolower($2); exit}')"

echo "  GET /health -> HTTP ${health_status}"
cat /tmp/pipewatch-smoke-admin-health.json
echo ""
echo "  GET /version -> HTTP ${version_status}"
cat /tmp/pipewatch-smoke-admin-version.json
echo ""
echo "  GET /login -> HTTP ${ui_status} (Content-Type: ${ui_content_type:-unknown})"

if [[ "${health_status}" != "200" || "${version_status}" != "200" ]]; then
  echo "Smoke failed for admin portal API probes" >&2
  exit 1
fi

if [[ "${ui_status}" != "200" ]]; then
  echo "Smoke failed: expected HTTP 200 from ${ui_url}" >&2
  exit 1
fi

if [[ "${ui_content_type}" != *"text/html"* ]]; then
  echo "Smoke failed: expected text/html from ${ui_url}, got ${ui_content_type:-unknown}" >&2
  exit 1
fi

asset_path="$(grep -oE '/assets/[^"'\'' >]+' /tmp/pipewatch-smoke-admin-ui.html | head -1 || true)"
if [[ -z "${asset_path}" ]]; then
  echo "Smoke failed: no /assets/ URL found in root HTML" >&2
  exit 1
fi

asset_url="${ADMIN_URL%/}${asset_path}"
asset_status="$(smoke_curl -s -o /dev/null -w '%{http_code}' "${asset_url}")"
echo "  GET ${asset_path} -> HTTP ${asset_status}"

if [[ "${asset_status}" != "200" ]]; then
  echo "Smoke failed: expected HTTP 200 from ${asset_url}" >&2
  exit 1
fi

manifest_url="${ADMIN_URL%/}/__manifest"
manifest_status="$(smoke_curl -s -o /dev/null -w '%{http_code}' "${manifest_url}")"
echo "  GET /__manifest -> HTTP ${manifest_status}"

if [[ "${manifest_status}" == "404" ]]; then
  echo "Smoke failed: GET /__manifest returned 404 (RR7 manifest not routed)" >&2
  exit 1
fi

echo "Admin smoke passed"
