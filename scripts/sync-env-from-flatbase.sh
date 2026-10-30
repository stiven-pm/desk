#!/usr/bin/env bash
# Copia secretos/IDs compartidos de flatbase → desk (.env.test / .env.production)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FB="/home/yei/Documentos/Rekov Systems/flatbase"
exec python3 - "$ROOT" "$FB" <<'PY'
import re
import sys
from pathlib import Path

chatbot = Path(sys.argv[1])
flatbase = Path(sys.argv[2])

COPY_KEYS = [
    "JWT_SECRET",
    "CREEM_API_KEY",
    "CREEM_WEBHOOK_SECRET",
    "CF_ACCOUNT_ID",
    "CF_ZONE_ID",
    "CF_API_TOKEN",
    "CF_D1_ADMIN_TOKEN",
    "R2_STORAGE_ENDPOINT",
    "R2_STORAGE_REGION",
    "R2_STORAGE_ACCESS_KEY_ID",
    "R2_STORAGE_SECRET_ACCESS_KEY",
    "GOTRUE_SMTP_ADMIN_EMAIL",
    "OPS_BOOTSTRAP_EMAIL",
]

FB_MAP = [
    ("CREEM_PRODUCT_HOBBY", "CREEM_PRODUCT_STARTER"),
    ("CREEM_PRODUCT_STARTUP", "CREEM_PRODUCT_GROWTH"),
    ("CREEM_PRODUCT_PRO", "CREEM_PRODUCT_BUSINESS"),
]

def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        out[k.strip()] = v.strip()
    return out

def creem_from_wrangler(env_name: str) -> dict[str, str]:
    wr = flatbase / "infra/cloudflare/wrangler.toml"
    text = wr.read_text()
    chunk = text.split("[env.test]")[1] if env_name == "test" else text.split("[env.test]")[0]
    out = {}
    for fb, desk in FB_MAP:
        m = re.search(rf"^{fb}\s*=\s*\"([^\"]+)\"", chunk, re.M)
        if m:
            out[desk] = m.group(1)
    return out

for env_name in ("test", "production"):
    src = parse_env(flatbase / f".env.{env_name}")
    desk_urls = parse_env(chatbot / "infra/cloudflare" / f"desk-urls.{env_name}.env")
    lines = [f"# Desk {env_name} — from flatbase", ""]
    for k, v in desk_urls.items():
        lines.append(f"{k}={v}")
    lines.append("")
    for k in COPY_KEYS:
        if src.get(k):
            lines.append(f"{k}={src[k]}")
    if src.get("JWT_SECRET"):
        lines.append(f"ENCRYPTION_KEY={src['JWT_SECRET']}")
    existing = parse_env(chatbot / f".env.{env_name}")
    ops_pw = (
        existing.get("OPS_BOOTSTRAP_PASSWORD")
        or existing.get("OPS_ADMIN_PASSWORD")
        or src.get("OPS_BOOTSTRAP_PASSWORD")
        or src.get("OPS_ADMIN_PASSWORD")
        or src.get("JWT_SECRET")
        or ""
    )
    if ops_pw:
        lines.append(f"OPS_BOOTSTRAP_PASSWORD={ops_pw}")
    ops = src.get("OPS_BOOTSTRAP_EMAIL") or src.get("GOTRUE_SMTP_ADMIN_EMAIL") or ""
    if ops:
        lines.append(f"OPS_BOOTSTRAP_ADMIN_EMAILS={ops}")
    if src.get("GOTRUE_SMTP_ADMIN_EMAIL"):
        lines.append(f"DESK_FROM_EMAIL={src['GOTRUE_SMTP_ADMIN_EMAIL']}")
    lines.append("")
    for dk, dv in creem_from_wrangler(env_name).items():
        lines.append(f"{dk}={dv}")
    lines.append("")
    existing = parse_env(chatbot / f".env.{env_name}")
    if env_name == "production":
        binding_keys = [
            "D1_DATABASE_ID",
            "KV_TENANT_CACHE_ID",
            "KV_TENANT_CACHE_PREVIEW_ID",
        ]
    else:
        binding_keys = [
            "D1_DATABASE_ID_TEST",
            "KV_TENANT_CACHE_ID_TEST",
            "KV_TENANT_CACHE_PREVIEW_ID_TEST",
        ]
    lines.append("# Cloudflare binding IDs (Desk — npm run cf:bindings:resolve o cf:provision:test)")
    for bk in binding_keys:
        lines.append(f"{bk}={existing.get(bk, '')}")
    lines.append("")
    lines.append("# sync: npm run env:sync-flatbase")
    (chatbot / f".env.{env_name}").write_text("\n".join(lines) + "\n")

# .dev.vars for wrangler dev
test = parse_env(chatbot / ".env.test")
dev_lines = []
for k in ["JWT_SECRET", "CREEM_API_KEY", "CREEM_WEBHOOK_SECRET", "ENCRYPTION_KEY", "OPS_BOOTSTRAP_PASSWORD"]:
    if test.get(k):
        dev_lines.append(f"{k}={test[k]}")
(chatbot / ".dev.vars").write_text("\n".join(dev_lines) + ("\n" if dev_lines else ""))
print("Synced .env.test, .env.production, .dev.vars from flatbase")
PY
python3 "$ROOT/scripts/resolve-desk-cf-bindings.py" || true
echo "Env listo. Deploy: npm run cf:test:deploy (provision + render + migrate incluidos)"
