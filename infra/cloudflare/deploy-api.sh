#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
bash "$(dirname "$0")/prepare-deploy.sh" production
exec env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config infra/cloudflare/wrangler.toml --env="" --env-file /dev/null "$@"
