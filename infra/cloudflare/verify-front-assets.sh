#!/usr/bin/env bash
# Fail deploy if marketing brand files did not land in OpenNext static output.
set -euo pipefail
PKG="${1:?dashboard|ops-dashboard}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ASSETS="$ROOT/packages/$PKG/.open-next/assets"

if [[ "$PKG" == "dashboard" ]]; then
  for f in brand/desk-logo-dark.png brand/desk-mark-gradient.jpg; do
    [[ -f "$ASSETS/$f" ]] || {
      echo "verify-front-assets: missing $ASSETS/$f — public/ not in OpenNext bundle" >&2
      exit 1
    }
  done
fi

echo "verify-front-assets: ok ($PKG)"
