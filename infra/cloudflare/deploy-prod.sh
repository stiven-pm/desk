#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
bash "$(dirname "$0")/prepare-deploy.sh" production
bash "$(dirname "$0")/build-widget-assets.sh"
CFG="$ROOT/infra/cloudflare/wrangler.toml"

# shellcheck source=dashboard-build-env.sh
source "$(dirname "$0")/dashboard-build-env.sh"
export_dashboard_build_env production "$ROOT"

env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config "$CFG" --env="" --env-file /dev/null
( cd "$ROOT/packages/dashboard" && npm run build && npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion )
bash "$(dirname "$0")/sanitize-opennext-env.sh" dashboard
bash "$(dirname "$0")/verify-front-assets.sh" dashboard
env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config "$ROOT/packages/dashboard/wrangler.toml" --env="" --env-file /dev/null

export_ops_build_env production "$ROOT"
( cd "$ROOT/packages/ops-dashboard" && npm run build && npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion )
bash "$(dirname "$0")/sanitize-opennext-env.sh" ops-dashboard
bash "$(dirname "$0")/verify-front-assets.sh" ops-dashboard
env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config "$ROOT/packages/ops-dashboard/wrangler.toml" --env="" --env-file /dev/null

print_deploy_urls production "$ROOT"
