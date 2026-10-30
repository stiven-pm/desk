#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
bash "$(dirname "$0")/prepare-deploy.sh" test
bash "$(dirname "$0")/build-widget-assets.sh"
CFG="$ROOT/infra/cloudflare/wrangler.toml"

# shellcheck source=dashboard-build-env.sh
source "$(dirname "$0")/dashboard-build-env.sh"
export_dashboard_build_env test "$ROOT"

env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config "$CFG" --env test --env-file /dev/null
( cd "$ROOT/packages/dashboard" && npm run build && npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion )
bash "$(dirname "$0")/sanitize-opennext-env.sh" dashboard
bash "$(dirname "$0")/verify-front-assets.sh" dashboard
env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config "$ROOT/packages/dashboard/wrangler.toml" --env test --env-file /dev/null

export_ops_build_env test "$ROOT"
( cd "$ROOT/packages/ops-dashboard" && npm run build && npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion )
bash "$(dirname "$0")/sanitize-opennext-env.sh" ops-dashboard
bash "$(dirname "$0")/verify-front-assets.sh" ops-dashboard
env -u CF_API_TOKEN -u CLOUDFLARE_API_TOKEN npx wrangler deploy --config "$ROOT/packages/ops-dashboard/wrangler.toml" --env test --env-file /dev/null

print_deploy_urls test "$ROOT"
CREEM_HOOK="$(_read_env_key "$ROOT/.env.test" PLATFORM_API_URL 2>/dev/null || _read_env_key "$ROOT/.env.test" NEXT_PUBLIC_API_URL 2>/dev/null || echo https://api-test-desk.rekov.co)"
echo "Creem test webhook: ${CREEM_HOOK}/webhooks/creem"
