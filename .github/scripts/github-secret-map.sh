#!/usr/bin/env bash
# Maps Phase/GHA storage keys (GH_*) to Fly/runtime keys (GITHUB_*).
# Sourced by sync-secrets.sh before flyctl secrets set (PRD §10, §23, Decision #33).

map_github_storage_to_runtime() {
  local storage runtime pair
  local -a pairs=(
    GH_APP_ID:GITHUB_APP_ID
    GH_APP_PRIVATE_KEY:GITHUB_APP_PRIVATE_KEY
    GH_WEBHOOK_SECRET:GITHUB_WEBHOOK_SECRET
    GH_CLIENT_ID:GITHUB_CLIENT_ID
    GH_CLIENT_SECRET:GITHUB_CLIENT_SECRET
    GH_APP_SLUG:GITHUB_APP_SLUG
  )

  for pair in "${pairs[@]}"; do
    storage="${pair%%:*}"
    runtime="${pair#*:}"
    if [[ -n "${!storage-}" ]]; then
      export "${runtime}=${!storage}"
    fi
  done
}
