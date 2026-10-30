#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://127.0.0.1:8787}"
curl -sf "$API/health" | grep -q '"status":"ok"'
curl -sf "$API/openapi.json" | grep -q 'Chatbot Platform API'
echo "smoke ok: $API"
