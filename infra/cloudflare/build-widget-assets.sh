#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/packages/platform-api/assets/desk-widget.js"
( cd "$ROOT/packages/widget" && npm run build )
cp "$ROOT/packages/widget/dist/embed.iife.js" "$OUT"
HOST_OUT="$ROOT/packages/platform-api/assets/desk-host.js"
cp "$ROOT/packages/widget/dist/host.iife.js" "$HOST_OUT"
echo "Widget asset: $OUT ($(wc -c < "$OUT") bytes)"
echo "Host asset: $HOST_OUT ($(wc -c < "$HOST_OUT") bytes)"
