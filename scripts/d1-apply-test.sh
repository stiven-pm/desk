#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/infra/cloudflare/prepare-deploy.sh" test
echo "D1 test migrations applied."
