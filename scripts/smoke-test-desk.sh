#!/usr/bin/env bash
# Smoke Desk API + marketing + widget CDN. Usage: smoke-test-desk.sh [test|production]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-test}"

case "$TARGET" in
  test)
    ENV_FILE="$ROOT/.env.test"
    ;;
  production | prod)
    ENV_FILE="$ROOT/.env.production"
    TARGET=production
    ;;
  *)
    echo "Usage: $0 [test|production]" >&2
    exit 1
    ;;
esac

[[ -f "$ENV_FILE" ]] || {
  echo "Missing $ENV_FILE" >&2
  exit 1
}

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

API="${API_URL:-${PLATFORM_API_URL:-$NEXT_PUBLIC_API_URL}}"
DESK="${DESK_URL:-${APP_URL:-$NEXT_PUBLIC_APP_URL}}"
OPS="${OPS_URL:-${OPS_APP_URL:-$NEXT_PUBLIC_OPS_APP_URL}}"
[[ -n "$API" && -n "$DESK" && -n "$OPS" ]] || {
  echo "Set URLs in $ENV_FILE" >&2
  exit 1
}

curl -sf "$API/health" | grep -q '"product":"desk"'
curl -sf "$API/openapi.json" | grep -q 'Chatbot Platform API'
curl -sf "$API/cdn/desk-widget.js" | grep -q 'DeskWidget\|ChatbotWidget'
curl -sfI "$DESK" | head -1 | grep -qE '200|301|302|307'
curl -sf -o /dev/null -w "%{http_code}" "$DESK/brand/desk-logo-dark.png" | grep -q 200
curl -sfI "$OPS" | head -1 | grep -qE '200|301|302|307'
curl -sfI "$OPS/orgs" | head -1 | grep -qE '200|301|302|307'
curl -sf "$API/v1/public/meta" | grep -q '"product":"desk"'

echo "smoke ok ($TARGET) api=$API desk=$DESK ops=$OPS widget=$API/cdn/desk-widget.js"
