#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CFG="$ROOT/infra/cloudflare/wrangler.toml"

SECRET_KEYS=(
  JWT_SECRET
  CREEM_API_KEY
  CREEM_WEBHOOK_SECRET
  ENCRYPTION_KEY
  TURNSTILE_SECRET_KEY
  OPS_BOOTSTRAP_PASSWORD
  GOOGLE_OAUTH_CLIENT_SECRET
  HUBSPOT_OAUTH_CLIENT_SECRET
  SHOPIFY_OAUTH_CLIENT_SECRET
)

usage() {
  echo "Usage: $0 [production|test|both]" >&2
  exit 1
}

TARGET="${1:-both}"
case "$TARGET" in
  production | prod) ENVS=(production) ;;
  test) ENVS=(test) ;;
  both) ENVS=(production test) ;;
  *) usage ;;
esac

read_env_value() {
  local file="$1" key="$2"
  python3 - "$file" "$key" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
key = sys.argv[2]
if not path.is_file():
    sys.exit(2)
for line in path.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#"):
        continue
    if not s.startswith(f"{key}="):
        continue
    val = s.split("=", 1)[1].strip()
    if val:
        print(val, end="")
        sys.exit(0)
sys.exit(1)
PY
}

push_secrets() {
  local env_name="$1"
  local env_file="$2"
  local wrangler_env=()
  if [[ "$env_name" == "test" ]]; then
    wrangler_env=(--env test)
  else
    wrangler_env=(--env "")
  fi
  [[ -f "$env_file" ]] || { echo "Missing $env_file" >&2; return 1; }
  for key in "${SECRET_KEYS[@]}"; do
    if val="$(read_env_value "$env_file" "$key" 2>/dev/null)"; then
      printf '%s' "$val" | npx wrangler secret put "$key" --config "$CFG" "${wrangler_env[@]}"
    fi
  done
}

for env_name in "${ENVS[@]}"; do
  if [[ "$env_name" == "test" ]]; then
    push_secrets test "$ROOT/.env.test"
  else
    push_secrets production "$ROOT/.env.production"
  fi
done
