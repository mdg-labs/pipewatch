#!/usr/bin/env bash
# Install repo-local git hooks (.githooks/) — run once per clone via pnpm setup:hooks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

git config core.hooksPath .githooks
printf 'Git hooks installed: core.hooksPath=.githooks\n'
