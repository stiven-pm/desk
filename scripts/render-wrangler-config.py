#!/usr/bin/env python3
"""Render wrangler.toml files from templates + .env.test / .env.production."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

SHARED_ENV_KEYS = [
    "CF_ACCOUNT_ID",
    "CF_ZONE_ID",
    "R2_STORAGE_ENDPOINT",
    "APP_URL",
    "OPS_APP_URL",
    "PLATFORM_API_URL",
    "OPS_BOOTSTRAP_ADMIN_EMAILS",
    "CREEM_API_BASE_URL",
    "CREEM_PRODUCT_STARTER",
    "CREEM_PRODUCT_GROWTH",
    "CREEM_PRODUCT_BUSINESS",
    "DESK_FROM_EMAIL",
]

REQUIRED_PROD = [
    *SHARED_ENV_KEYS,
    "D1_DATABASE_ID",
    "KV_TENANT_CACHE_ID",
    "KV_TENANT_CACHE_PREVIEW_ID",
]

REQUIRED_TEST = [
    *SHARED_ENV_KEYS,
    "D1_DATABASE_ID_TEST",
    "KV_TENANT_CACHE_ID_TEST",
    "KV_TENANT_CACHE_PREVIEW_ID_TEST",
]

OAUTH_VAR_KEYS = (
    "GOOGLE_OAUTH_CLIENT_ID",
    "HUBSPOT_OAUTH_CLIENT_ID",
    "SHOPIFY_OAUTH_CLIENT_ID",
)

OPTIONAL_CREEM_WALLET_KEYS = (
    "CREEM_PRODUCT_CREDITS_25",
    "CREEM_PRODUCT_CREDITS_50",
    "CREEM_PRODUCT_CREDITS_100",
)

OPTIONAL_WHATSAPP_AND_AUTH_KEYS = (
    "META_APP_ID",
    "WHATSAPP_EMBEDDED_CONFIG_ID",
    "META_GRAPH_VERSION",
    "LOGIN_OTP_BYPASS_EMAILS",
)

OPTIONAL_TURNSTILE_KEYS = ("TURNSTILE_SITE_KEY",)

OPTIONAL_DEFAULTS = {
    "CHATBOT_ENV": ("production", "test"),
    "SIGNUPS_OPEN": ("true", "true"),
    "WORKERS_AI_CHAT_MODEL": ("@cf/zai-org/glm-5.3-flash", "@cf/zai-org/glm-5.3-flash"),
    "WORKERS_AI_EMBEDDING_MODEL": ("@cf/baai/bge-m3", "@cf/baai/bge-m3"),
    "LLM_REQUEST_TIMEOUT_MS": ("45000", "45000"),
    "LLM_STREAM_ENABLED": ("true", "true"),
    "EMBEDDING_DIMENSIONS": ("1024", "1024"),
    "AGENT_FLOW_TOOLS": ("1", "1"),
    "AGENT_DRIVEN_WIZARD": ("1", "1"),
    "INTEGRATION_CODE_MODE": ("1", "1"),
    "DESK_TRACE": ("0", "1"),
    "DESK_LLM_DEBUG": ("0", "1"),
}


def clean_env_value(raw: str) -> str:
    """Strip inline comments (e.g. `1 # default`) so wrangler vars stay exact."""
    return re.sub(r"\s+#.*$", "", raw.strip()).strip()


def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        out[k.strip()] = clean_env_value(v)
    return out


def host_from_url(url: str, key: str) -> str:
    if not url:
        raise SystemExit(f"Missing {key}")
    h = urlparse(url).hostname
    if not h:
        raise SystemExit(f"Invalid URL for {key}: {url}")
    return h


def missing(keys: list[str], env: dict[str, str], label: str) -> list[str]:
    return [k for k in keys if not env.get(k)]


def substitute(template: str, mapping: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in mapping:
            raise SystemExit(f"Template key {{{{{key}}}}} not in mapping")
        return mapping[key]

    return re.sub(r"\{\{([A-Z0-9_]+)\}\}", repl, template)


def build_api_mapping(prod: dict[str, str], test: dict[str, str]) -> dict[str, str]:
    miss_p = missing(REQUIRED_PROD, prod, ".env.production")
    miss_t = missing(REQUIRED_TEST, test, ".env.test")
    if miss_p:
        raise SystemExit(f".env.production missing: {', '.join(miss_p)}")
    if miss_t:
        raise SystemExit(f".env.test missing: {', '.join(miss_t)}")

    acc = prod["CF_ACCOUNT_ID"]
    if test.get("CF_ACCOUNT_ID") and test["CF_ACCOUNT_ID"] != acc:
        print("warn: CF_ACCOUNT_ID differs between test and production", file=sys.stderr)

    m: dict[str, str] = {"CF_ACCOUNT_ID": acc}
    shared_keys = (
        "APP_URL",
        "OPS_APP_URL",
        "PLATFORM_API_URL",
        "OPS_BOOTSTRAP_ADMIN_EMAILS",
        "CREEM_API_BASE_URL",
        "CREEM_PRODUCT_STARTER",
        "CREEM_PRODUCT_GROWTH",
        "CREEM_PRODUCT_BUSINESS",
        "DESK_FROM_EMAIL",
        "CF_ZONE_ID",
        "R2_STORAGE_ENDPOINT",
    )
    for k in shared_keys:
        m[f"{k}_PROD"] = prod[k]
        m[f"{k}_TEST"] = test[k]

    for key, (p_def, t_def) in OPTIONAL_DEFAULTS.items():
        m[f"{key}_PROD"] = prod.get(key, p_def)
        m[f"{key}_TEST"] = test.get(key, t_def)

    for key in OAUTH_VAR_KEYS:
        m[f"{key}_PROD"] = prod.get(key, "")
        m[f"{key}_TEST"] = test.get(key, "")
    for key in OPTIONAL_CREEM_WALLET_KEYS:
        m[f"{key}_PROD"] = prod.get(key, "")
        m[f"{key}_TEST"] = test.get(key, "")
    for key in OPTIONAL_WHATSAPP_AND_AUTH_KEYS:
        m[f"{key}_PROD"] = prod.get(key, "")
        m[f"{key}_TEST"] = test.get(key, "")
    for key in OPTIONAL_TURNSTILE_KEYS:
        m[f"{key}_PROD"] = prod.get(key, "")
        m[f"{key}_TEST"] = test.get(key, prod.get(key, ""))

    m["API_ROUTE_HOST_PROD"] = host_from_url(prod["PLATFORM_API_URL"], "PLATFORM_API_URL")
    m["API_ROUTE_HOST_TEST"] = host_from_url(test["PLATFORM_API_URL"], "PLATFORM_API_URL")
    m["D1_DATABASE_ID_PROD"] = prod["D1_DATABASE_ID"]
    m["D1_DATABASE_ID_TEST"] = test["D1_DATABASE_ID_TEST"]
    m["KV_TENANT_CACHE_ID_PROD"] = prod["KV_TENANT_CACHE_ID"]
    m["KV_TENANT_CACHE_PREVIEW_ID_PROD"] = prod["KV_TENANT_CACHE_PREVIEW_ID"]
    m["KV_TENANT_CACHE_ID_TEST"] = test["KV_TENANT_CACHE_ID_TEST"]
    m["KV_TENANT_CACHE_PREVIEW_ID_TEST"] = test["KV_TENANT_CACHE_PREVIEW_ID_TEST"]
    return m


def render_api(m: dict[str, str]) -> None:
    tpl = (ROOT / "infra/cloudflare/wrangler.toml.template").read_text()
    out = substitute(tpl, m)
    dest = ROOT / "infra/cloudflare/wrangler.toml"
    dest.write_text(out)
    print(f"wrote {dest.relative_to(ROOT)}")


def render_dashboard(m: dict[str, str], prod: dict[str, str], test: dict[str, str]) -> None:
    dm = {
        **m,
        "DESK_APP_HOST_PROD": host_from_url(prod.get("NEXT_PUBLIC_APP_URL") or prod["APP_URL"], "APP_URL"),
        "DESK_APP_HOST_TEST": host_from_url(test.get("NEXT_PUBLIC_APP_URL") or test["APP_URL"], "APP_URL"),
    }
    tpl = (ROOT / "packages/dashboard/wrangler.toml.template").read_text()
    (ROOT / "packages/dashboard/wrangler.toml").write_text(substitute(tpl, dm))
    print("wrote packages/dashboard/wrangler.toml")

    om = {
        **dm,
        "OPS_APP_HOST_PROD": host_from_url(
            prod.get("NEXT_PUBLIC_OPS_APP_URL") or prod["OPS_APP_URL"], "OPS_APP_URL"
        ),
        "OPS_APP_HOST_TEST": host_from_url(
            test.get("NEXT_PUBLIC_OPS_APP_URL") or test["OPS_APP_URL"], "OPS_APP_URL"
        ),
    }
    tpl = (ROOT / "packages/ops-dashboard/wrangler.toml.template").read_text()
    (ROOT / "packages/ops-dashboard/wrangler.toml").write_text(substitute(tpl, om))
    print("wrote packages/ops-dashboard/wrangler.toml")


def main() -> None:
    prod = parse_env(ROOT / ".env.production")
    test = parse_env(ROOT / ".env.test")
    m = build_api_mapping(prod, test)
    render_api(m)
    render_dashboard(m, prod, test)


if __name__ == "__main__":
    main()
