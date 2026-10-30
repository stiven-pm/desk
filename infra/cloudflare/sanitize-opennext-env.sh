#!/usr/bin/env bash
# OpenNext embeds full .env.* into next-env.mjs — strip to public vars only.
set -euo pipefail
PKG="${1:?dashboard|ops-dashboard}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/packages/$PKG/.open-next/cloudflare/next-env.mjs"
[[ -f "$ENV_FILE" ]] || { echo "sanitize-opennext-env: missing $ENV_FILE" >&2; exit 1; }

python3 - "$ENV_FILE" "$PKG" <<'PY'
import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
allowed_prefixes = ("NEXT_PUBLIC_",)
allowed_exact = frozenset(
    {
        "NODE_ENV",
        "NEXT_RUNTIME",
    }
)

def filter_obj(obj: dict) -> dict:
    out = {}
    for k, v in obj.items():
        if k in allowed_exact or k.startswith(allowed_prefixes):
            out[k] = v
    return out

blocks = []
for mode in ("production", "development", "test"):
    m = re.search(
        rf"export const {mode} = (\{{.*?\}});",
        text,
        re.DOTALL,
    )
    if not m:
        continue
    raw = m.group(1)
    data = json.loads(raw)
    blocks.append(f"export const {mode} = {json.dumps(filter_obj(data), ensure_ascii=False)};\n")

if not blocks:
    print("sanitize-opennext-env: no env blocks found", file=sys.stderr)
    sys.exit(1)

path.write_text("".join(blocks))
print(f"sanitize-opennext-env: ok ({sys.argv[2]})")
PY
