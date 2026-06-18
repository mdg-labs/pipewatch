#!/usr/bin/env bash
# Inner E2E runner — invoked inside test-with-deps.sh with DATABASE_URL set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDITION="${PIPEWATCH_EDITION:-cloud}"

API_PID=""
WEB_PID=""
CLEANUP_DONE=0

log() {
  printf 'test-e2e: %s\n' "$*" >&2
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-90}"
  local attempt=0

  while [[ "$attempt" -lt "$attempts" ]]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.5
  done

  log "service did not become ready: ${url}"
  return 1
}

stop_service() {
  local pid="$1"
  local name="$2"

  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    log "stopping ${name} (pid ${pid})"
    kill -TERM "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

cleanup_services() {
  if [[ "$CLEANUP_DONE" -eq 1 ]]; then
    return 0
  fi
  CLEANUP_DONE=1
  stop_service "$WEB_PID" "web"
  stop_service "$API_PID" "api"
  WEB_PID=""
  API_PID=""
}

trap cleanup_services EXIT
trap 'cleanup_services; exit 130' INT
trap 'cleanup_services; exit 130' TERM

pick_port() {
  node -e "const net=require('node:net');const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>process.stdout.write(String(port)));});"
}

WEB_PORT="$(pick_port)"
API_PORT="$(pick_port)"
APP_URL="http://127.0.0.1:${WEB_PORT}"
API_URL="http://127.0.0.1:${API_PORT}"

export E2E_APP_URL="$APP_URL"
export E2E_API_URL="$API_URL"
export PIPEWATCH_EDITION="$EDITION"

log "building workspace packages"
(
  cd "$ROOT"
  pnpm build --filter @pipewatch/api --filter @pipewatch/web --filter @pipewatch/db --filter @pipewatch/config --filter @pipewatch/types --filter @pipewatch/utils
)

log "starting API on ${API_URL}"
(
  cd "$ROOT"
  env \
    NODE_ENV=development \
    PIPEWATCH_EDITION="$EDITION" \
    PORT="$API_PORT" \
    APP_URL="$APP_URL" \
    MARKETING_URL="https://pipewatch.app" \
    DATABASE_URL="$DATABASE_URL" \
    REDIS_URL="${REDIS_URL:-}" \
    JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
    JWT_REFRESH_SECRET=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
    ENCRYPTION_KEY=cccccccccccccccccccccccccccccccc \
    GITHUB_CLIENT_ID=e2e-test-client-id \
    GITHUB_CLIENT_SECRET=dddddddddddddddddddddddddddddddd \
    GITHUB_APP_ID=123456 \
    GITHUB_APP_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----' \
    GITHUB_WEBHOOK_SECRET=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee \
    GITHUB_APP_SLUG=pipewatch-e2e \
    pnpm --filter @pipewatch/api start
) &
API_PID=$!

log "starting web on ${APP_URL}"
(
  cd "$ROOT"
  env \
    NODE_ENV=development \
    PIPEWATCH_EDITION="$EDITION" \
    PORT="$WEB_PORT" \
    NEXT_PUBLIC_API_URL="$API_URL" \
    pnpm --filter @pipewatch/web start
) &
WEB_PID=$!

wait_for_http "${API_URL}/health"
wait_for_http "${APP_URL}/sign-in"

log "running Playwright"
(
  cd "$ROOT"
  pnpm exec playwright test --config e2e/playwright.config.ts "$@"
)
playwright_status=$?

cleanup_services
exit "$playwright_status"
