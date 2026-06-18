#!/usr/bin/env bash
# Minimal CE image push stub — full multi-image workflow lands in #113 (PRD §22).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "build-ce-image-stub: usage: build-ce-image-stub.sh <tag> [<tag> ...]" >&2
  exit 1
fi

TAGS=("$@")

echo "build-ce-image-stub: pushing API image tags: ${TAGS[*]}"

for tag in "${TAGS[@]}"; do
  docker build -f apps/api/Dockerfile -t "$tag" .
  docker push "$tag"
done

echo "build-ce-image-stub: done"
