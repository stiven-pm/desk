#!/usr/bin/env bash
# Idempotente: env, provision D1/KV, resolve IDs, render wrangler, D1 migrations.
set -euo pipefail
TARGET="${1:?test|production}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FB_DEFAULT="/home/yei/Documentos/Rekov Systems/flatbase"
FLATBASE_ROOT="${FLATBASE_ROOT:-$FB_DEFAULT}"

case "$TARGET" in
  test) ENV_FILE="$ROOT/.env.test" ;;
  production) ENV_FILE="$ROOT/.env.production" ;;
  *)
    echo "prepare-deploy: unknown target $TARGET" >&2
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -d "$FLATBASE_ROOT" ]]; then
    echo "prepare-deploy: missing $(basename "$ENV_FILE"), syncing from flatbase…"
    bash "$ROOT/scripts/sync-env-from-flatbase.sh"
  else
    echo "prepare-deploy: missing $ENV_FILE (copy from .env.${TARGET}.example or set FLATBASE_ROOT)" >&2
    exit 1
  fi
fi

echo "prepare-deploy ($TARGET): provision → resolve → render → D1 migrate"
bash "$ROOT/scripts/provision-desk.sh" "$TARGET"
python3 "$ROOT/scripts/resolve-desk-cf-bindings.py"
bash "$ROOT/scripts/render-wrangler-config.sh"

CFG="$ROOT/infra/cloudflare/wrangler.toml"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

d1_migrate() {
  local db_name="$1"
  local wrangler_env="${2:-}"
  local -a extra=()
  if [[ -n "$wrangler_env" ]]; then
    extra=(--env "$wrangler_env")
  else
    extra=(--env "")
  fi
  # OAuth de wrangler suele no incluir D1; usar token con permiso D1 si existe.
  if [[ -n "${CF_D1_ADMIN_TOKEN:-}" ]]; then
    CF_API_TOKEN="$CF_D1_ADMIN_TOKEN" CLOUDFLARE_API_TOKEN="$CF_D1_ADMIN_TOKEN" \
      npx wrangler d1 migrations apply "$db_name" --remote --config "$CFG" "${extra[@]}"
  elif [[ -n "${CF_API_TOKEN:-}" ]]; then
    CF_API_TOKEN="$CF_API_TOKEN" CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" \
      npx wrangler d1 migrations apply "$db_name" --remote --config "$CFG" "${extra[@]}"
  else
    env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN \
      npx wrangler d1 migrations apply "$db_name" --remote --config "$CFG" "${extra[@]}"
  fi
}

if [[ "$TARGET" == "test" ]]; then
  d1_migrate desk-control-test test
  echo "prepare-deploy: backfill products.search_text (test)"
  npx tsx "$ROOT/scripts/backfill-product-search-text.ts" --remote --test
else
  d1_migrate desk-control ""
  echo "prepare-deploy: backfill products.search_text (production)"
  npx tsx "$ROOT/scripts/backfill-product-search-text.ts" --remote
fi
