#!/usr/bin/env bash
# Idempotente: crea D1/KV de Desk si no existen (por entorno).
set -euo pipefail
TARGET="${1:?test|production}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/infra/cloudflare/desk-resource-names.env"

case "$TARGET" in
  test)
    ENV_FILE="$ROOT/.env.test"
    D1_NAME="$D1_DATABASE_NAME_TEST"
    KV_TITLES=("$KV_TENANT_CACHE_TITLE_TEST" "$KV_TENANT_CACHE_PREVIEW_TITLE_TEST")
    ;;
  production)
    ENV_FILE="$ROOT/.env.production"
    D1_NAME="$D1_DATABASE_NAME"
    KV_TITLES=("$KV_TENANT_CACHE_TITLE" "$KV_TENANT_CACHE_PREVIEW_TITLE")
    ;;
  *)
    echo "provision-desk: unknown target $TARGET" >&2
    exit 1
    ;;
esac

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID in $ENV_FILE}"

export CF_ACCOUNT_ID CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"
if [[ -n "${CF_API_TOKEN:-}" ]]; then
  export CF_API_TOKEN CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
fi

cd "$ROOT"

if ! npx wrangler d1 list --json | python3 -c "import json,sys; n='$D1_NAME'; sys.exit(0 if any(d.get('name')==n for d in json.load(sys.stdin)) else 1)"; then
  echo "Creating D1: $D1_NAME"
  npx wrangler d1 create "$D1_NAME"
fi

kv_fail=0
for title in "${KV_TITLES[@]}"; do
  kv_list_out="$(npx wrangler kv namespace list 2>&1)" || true
  if echo "$kv_list_out" | grep -q 'Authentication error'; then
    echo "provision-desk: KV API auth failed (code 10000)." >&2
    echo "  Tu CF_API_TOKEN suele ser solo D1. Añade permiso: Account → Workers KV Storage → Edit" >&2
    echo "  O crea en dashboard: Workers → KV → Create → títulos:" >&2
    printf '    - %s\n' "${KV_TITLES[@]}" >&2
    echo "  Luego pega los IDs en .env (KV_TENANT_CACHE_ID_TEST / PREVIEW) y vuelve a deploy." >&2
    kv_fail=1
    break
  fi
  if echo "$kv_list_out" | python3 -c "import json,sys; t='$title'; raw=sys.stdin.read().strip(); data=json.loads(raw) if raw.startswith('[') else []; sys.exit(0 if any(d.get('title')==t for d in data) else 1)"; then
    continue
  fi
  echo "Creating KV namespace: $title"
  create_out="$(npx wrangler kv namespace create "$title" 2>&1)" || true
  if echo "$create_out" | grep -q 'already exists'; then
    echo "  (already exists, ok)"
  elif echo "$create_out" | grep -q '✨ Success'; then
    echo "$create_out" | tail -3
  elif echo "$create_out" | grep -q 'ERROR'; then
    echo "$create_out" >&2
    kv_fail=1
  fi
done
if [[ "$kv_fail" -ne 0 ]]; then
  exit 1
fi
