#!/usr/bin/env bash
# Generate random secrets for PipeWatch CE Docker Compose.
# Usage:
#   bash scripts/generate-ce-secrets.sh              # print to stdout
#   bash scripts/generate-ce-secrets.sh --merge .env # fill empty keys in an existing .env
set -euo pipefail

gen_hex() {
  openssl rand -hex 32
}

merge_into() {
  local target="$1"
  if [[ ! -f "$target" ]]; then
    echo "generate-ce-secrets: file not found: $target" >&2
    exit 1
  fi

  local tmp
  tmp="$(mktemp)"
  cp "$target" "$tmp"

  set_if_empty() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$tmp"; then
      local current
      current="$(grep "^${key}=" "$tmp" | head -n1 | cut -d= -f2-)"
      if [[ -z "$current" ]]; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$tmp"
      fi
    else
      printf '\n%s=%s\n' "$key" "$value" >>"$tmp"
    fi
  }

  set_if_empty POSTGRES_PASSWORD "$(gen_hex)"
  set_if_empty REDIS_PASSWORD "$(gen_hex)"
  set_if_empty JWT_SECRET "$(gen_hex)"
  set_if_empty JWT_REFRESH_SECRET "$(gen_hex)"
  set_if_empty ENCRYPTION_KEY "$(gen_hex)"

  mv "$tmp" "$target"
  echo "generate-ce-secrets: merged empty CE secrets into $target"
}

print_secrets() {
  cat <<EOF
# PipeWatch CE secrets — paste into .env (values are hex; safe in connection URLs)
POSTGRES_PASSWORD=$(gen_hex)
REDIS_PASSWORD=$(gen_hex)
JWT_SECRET=$(gen_hex)
JWT_REFRESH_SECRET=$(gen_hex)
ENCRYPTION_KEY=$(gen_hex)
EOF
}

case "${1:-}" in
  --merge)
    merge_into "${2:-.env}"
    ;;
  "" | --help | -h)
    print_secrets
    ;;
  *)
    echo "Usage: $0 [--merge PATH]" >&2
    exit 1
    ;;
esac
