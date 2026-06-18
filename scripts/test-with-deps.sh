#!/usr/bin/env bash
# Ephemeral Postgres 16 + Redis 7 for local integration tests (PRD §11, Decision #38).
#
# Usage:
#   bash scripts/test-with-deps.sh [--] <command> [args...]
#   bash scripts/test-with-deps.sh --self-test
#
# Exports DATABASE_URL and REDIS_URL to the child process. Cleanup runs on
# EXIT, SIGINT, and SIGTERM — containers, volumes, and networks are removed.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="pipewatch-test"

POSTGRES_CONTAINER=""
REDIS_CONTAINER=""
POSTGRES_VOLUME=""
REDIS_VOLUME=""
NETWORK=""
CHILD_PID=""
CLEANUP_DONE=0

generate_run_id() {
  if [[ -n "${PIPEWATCH_TEST_RUN_ID:-}" ]]; then
    printf '%s' "$PIPEWATCH_TEST_RUN_ID"
    return
  fi
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]' | tr -d '-' | cut -c1-12
    return
  fi
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    tr -d '-' </proc/sys/kernel/random/uuid | cut -c1-12
    return
  fi
  printf '%s-%s' "$$" "$(date +%s)"
}

RUN_ID="$(generate_run_id)"

ready_marker_path() {
  printf '%s/pipewatch-test-ready-%s' "${TMPDIR:-/tmp}" "$1"
}

mark_ready() {
  : > "$(ready_marker_path "$RUN_ID")"
}

clear_ready_marker() {
  rm -f "$(ready_marker_path "$RUN_ID")"
}

log() {
  printf 'test-with-deps: %s\n' "$*" >&2
}

docker_port() {
  local container="$1"
  local mapping="$2"
  docker port "$container" "$mapping" 2>/dev/null | head -1 | awk -F: '{print $NF}'
}

count_labeled_resources() {
  local run_label="$1"
  local containers volumes networks
  containers="$(docker ps -aq --filter "label=pipewatch-test-run=${run_label}" 2>/dev/null | wc -l | tr -d ' ')"
  volumes="$(docker volume ls -q --filter "label=pipewatch-test-run=${run_label}" 2>/dev/null | wc -l | tr -d ' ')"
  networks="$(docker network ls -q --filter "label=pipewatch-test-run=${run_label}" 2>/dev/null | wc -l | tr -d ' ')"
  echo "$((containers + volumes + networks))"
}

cleanup() {
  local exit_code="${1:-$?}"

  if [[ "$CLEANUP_DONE" -eq 1 ]]; then
    exit "$exit_code"
  fi
  CLEANUP_DONE=1

  log "cleaning up run ${RUN_ID}"

  if [[ -n "$POSTGRES_CONTAINER" ]]; then
    docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ -n "$REDIS_CONTAINER" ]]; then
    docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ -n "$POSTGRES_VOLUME" ]]; then
    docker volume rm -f "$POSTGRES_VOLUME" >/dev/null 2>&1 || true
  fi
  if [[ -n "$REDIS_VOLUME" ]]; then
    docker volume rm -f "$REDIS_VOLUME" >/dev/null 2>&1 || true
  fi
  if [[ -n "$NETWORK" ]]; then
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
  fi

  docker container prune -f --filter "label=${LABEL}" >/dev/null 2>&1 || true
  docker volume prune -f --filter "label=${LABEL}" >/dev/null 2>&1 || true
  docker network prune -f --filter "label=${LABEL}" >/dev/null 2>&1 || true

  clear_ready_marker

  exit "$exit_code"
}

on_signal() {
  if [[ -n "$CHILD_PID" ]] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill -INT "$CHILD_PID" 2>/dev/null || kill -TERM "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
    CHILD_PID=""
  fi
  cleanup 130
}

trap cleanup EXIT
trap on_signal INT
trap on_signal TERM

wait_for_postgres() {
  local container="$1"
  local attempts="${2:-60}"
  local attempt=0
  while [[ "$attempt" -lt "$attempts" ]]; do
    if docker exec "$container" pg_isready -U pipewatch -d pipewatch >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.5
  done
  log "Postgres did not become ready in time"
  return 1
}

wait_for_redis() {
  local container="$1"
  local attempts="${2:-60}"
  local attempt=0
  while [[ "$attempt" -lt "$attempts" ]]; do
    if docker exec "$container" redis-cli ping 2>/dev/null | grep -q PONG; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 0.5
  done
  log "Redis did not become ready in time"
  return 1
}

start_deps() {
  NETWORK="pipewatch-test-net-${RUN_ID}"
  POSTGRES_VOLUME="pipewatch-test-pg-${RUN_ID}"
  REDIS_VOLUME="pipewatch-test-redis-${RUN_ID}"

  docker network create \
    --label "${LABEL}" \
    --label "pipewatch-test-run=${RUN_ID}" \
    "$NETWORK" >/dev/null

  docker volume create \
    --label "${LABEL}" \
    --label "pipewatch-test-run=${RUN_ID}" \
    "$POSTGRES_VOLUME" >/dev/null

  docker volume create \
    --label "${LABEL}" \
    --label "pipewatch-test-run=${RUN_ID}" \
    "$REDIS_VOLUME" >/dev/null

  POSTGRES_CONTAINER="$(
    docker run -d \
      --name "pipewatch-test-pg-${RUN_ID}" \
      --network "$NETWORK" \
      --label "${LABEL}" \
      --label "pipewatch-test-run=${RUN_ID}" \
      -e POSTGRES_DB=pipewatch \
      -e POSTGRES_USER=pipewatch \
      -e POSTGRES_PASSWORD=pipewatch \
      -v "${POSTGRES_VOLUME}:/var/lib/postgresql/data" \
      -p 127.0.0.1:0:5432 \
      postgres:16-alpine
  )"

  REDIS_CONTAINER="$(
    docker run -d \
      --name "pipewatch-test-redis-${RUN_ID}" \
      --network "$NETWORK" \
      --label "${LABEL}" \
      --label "pipewatch-test-run=${RUN_ID}" \
      -v "${REDIS_VOLUME}:/data" \
      -p 127.0.0.1:0:6379 \
      redis:7-alpine
  )"

  wait_for_postgres "$POSTGRES_CONTAINER"
  wait_for_redis "$REDIS_CONTAINER"

  local pg_port redis_port
  pg_port="$(docker_port "$POSTGRES_CONTAINER" 5432/tcp)"
  redis_port="$(docker_port "$REDIS_CONTAINER" 6379/tcp)"

  if [[ -z "$pg_port" || -z "$redis_port" ]]; then
    log "failed to resolve published ports (pg=${pg_port:-?}, redis=${redis_port:-?})"
    return 1
  fi

  export DATABASE_URL="postgresql://pipewatch:pipewatch@127.0.0.1:${pg_port}/pipewatch"
  export REDIS_URL="redis://127.0.0.1:${redis_port}"

  log "Postgres ready on 127.0.0.1:${pg_port}"
  log "Redis ready on 127.0.0.1:${redis_port}"
}

run_migrations() {
  if [[ "${PIPEWATCH_TEST_SKIP_MIGRATE:-}" == "1" ]]; then
    log "skipping migrations (PIPEWATCH_TEST_SKIP_MIGRATE=1)"
    return 0
  fi

  log "running Drizzle migrations"
  (
    cd "$ROOT"
    pnpm db:migrate
  )
}

run_self_test() {
  if ! command -v docker >/dev/null 2>&1; then
    log "self-test skipped — docker not available"
    exit 0
  fi

  local test_run_id child_pid remaining pg redis

  test_run_id="selftest-$$-exit"
  log "self-test: normal exit cleanup (run ${test_run_id})"
  if ! PIPEWATCH_TEST_RUN_ID="$test_run_id" PIPEWATCH_TEST_SKIP_MIGRATE=1 bash "$0" true; then
    log "self-test FAIL — wrapper exited non-zero on true"
    exit 1
  fi
  if [[ "$(count_labeled_resources "$test_run_id")" -ne 0 ]]; then
    log "self-test FAIL — resources remain after normal exit"
    exit 1
  fi

  test_run_id="selftest-$$-int"
  log "self-test: interrupt cleanup via timeout (run ${test_run_id})"
  timeout 5s \
    env PIPEWATCH_TEST_RUN_ID="$test_run_id" PIPEWATCH_TEST_SKIP_MIGRATE=1 \
    bash "$0" sleep 300 >/dev/null 2>&1 || true

  remaining="$(count_labeled_resources "$test_run_id")"
  if [[ "$remaining" -ne 0 ]]; then
    log "self-test FAIL — ${remaining} labeled resources remain for run ${test_run_id}"
    docker ps -a --filter "label=pipewatch-test-run=${test_run_id}" >&2 || true
    docker volume ls --filter "label=pipewatch-test-run=${test_run_id}" >&2 || true
    docker network ls --filter "label=pipewatch-test-run=${test_run_id}" >&2 || true
    exit 1
  fi

  log "self-test PASS — cleanup verified on exit and interrupt"
  CLEANUP_DONE=1
  exit 0
}

if [[ "${1:-}" == "--self-test" ]]; then
  run_self_test
fi

if [[ $# -eq 0 ]]; then
  log "usage: $0 [--self-test] [--] <command> [args...]"
  exit 2
fi

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -eq 0 ]]; then
  log "missing command after --"
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  log "docker is required for integration tests"
  exit 1
fi

start_deps
run_migrations
mark_ready

log "running: $*"
"$@" &
CHILD_PID=$!
wait "$CHILD_PID"
child_status=$?
CHILD_PID=""
exit "$child_status"
