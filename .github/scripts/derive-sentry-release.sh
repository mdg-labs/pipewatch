#!/usr/bin/env bash
# Derive a Sentry release identifier from package version and commit SHA.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

VERSION="${RELEASE_VERSION:-$(node -p "require('./package.json').version")}"
SHA="${GITHUB_SHA:-unknown}"
SHORT_SHA="${SHA:0:7}"
RELEASE="pipewatch@${VERSION}+${SHORT_SHA}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "release=${RELEASE}" >> "$GITHUB_OUTPUT"
fi

echo "derive-sentry-release: ${RELEASE}"
