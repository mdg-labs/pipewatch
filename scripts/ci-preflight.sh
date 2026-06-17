#!/usr/bin/env bash
# Resource preflight for agent CI runs. Safe for parallel Lane P sub-agents when
# WORK_ROOT points at each agent's own repo/worktree (default: cwd).
#
# Usage:
#   WORK_ROOT=/path/to/worktree CI_PREFLIGHT_MODE=local bash scripts/ci-preflight.sh
#
# Modes:
#   local  — clean turbo/vitest only under WORK_ROOT (default; parallel-safe)
#   global — also prune labeled integration test containers (Lane S serial only)

set -euo pipefail

WORK_ROOT="$(cd "${WORK_ROOT:-$(pwd)}" && pwd)"
MODE="${CI_PREFLIGHT_MODE:-local}"
export TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-1}"

warn_pids() {
  local current max
  current="$(cat /sys/fs/cgroup/user.slice/user-"$(id -u)".slice/pids.current 2>/dev/null || echo "?")"
  max="$(cat /sys/fs/cgroup/user.slice/user-"$(id -u)".slice/pids.max 2>/dev/null || echo "?")"
  echo "ci-preflight: user pids ${current}/${max} (WORK_ROOT=${WORK_ROOT} MODE=${MODE})"
  if [[ "$current" != "?" && "$max" != "?" && "$current" -gt $((max * 60 / 100)) ]]; then
    echo "ci-preflight: WARNING — user task count above 60% of limit" >&2
  fi
}

proc_cwd() {
  local pid="$1"
  readlink "/proc/${pid}/cwd" 2>/dev/null || true
}

kill_under_work_root() {
  local pattern="$1"
  local pid cwd
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    cwd="$(proc_cwd "$pid")"
    if [[ -n "$cwd" && "$cwd" == "${WORK_ROOT}"* ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done < <(pgrep -f "$pattern" 2>/dev/null || true)
}

warn_pids

# Stale turbo/vitest from prior runs in this worktree only — never global pkill
# (global pkill breaks parallel Lane P siblings).
kill_under_work_root '@turbo/linux-64'
kill_under_work_root '@turbo/linux-arm64'
kill_under_work_root 'vitest run'

if [[ "$MODE" == "global" ]]; then
  docker container prune -f --filter label=pipewatch-test 2>/dev/null || true
fi

echo "ci-preflight: TURBO_CONCURRENCY=${TURBO_CONCURRENCY} ready"
