#!/usr/bin/env python3
"""Fill D1/KV IDs in .env.* by listing Cloudflare resources (same account as Flatbase)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES_FILE = ROOT / "infra/cloudflare/desk-resource-names.env"


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


def write_env(path: Path, updates: dict[str, str]) -> None:
    if not path.is_file():
        return
    lines = path.read_text().splitlines()
    out_lines: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            key = line.split("=", 1)[0].strip()
            if key in updates:
                out_lines.append(f"{key}={updates[key]}")
                seen.add(key)
                continue
        out_lines.append(line)
    for key, val in updates.items():
        if key not in seen and val:
            out_lines.append(f"{key}={val}")
    path.write_text("\n".join(out_lines) + "\n")


def wrangler_run(args: list[str], account_id: str, token: str) -> str:
    env = os.environ.copy()
    env["CF_ACCOUNT_ID"] = account_id
    env["CLOUDFLARE_ACCOUNT_ID"] = account_id
    if token:
        env["CF_API_TOKEN"] = token
        env["CLOUDFLARE_API_TOKEN"] = token
    proc = subprocess.run(
        ["npx", "wrangler", *args],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        return ""
    return proc.stdout or ""


def parse_wrangler_list(stdout: str) -> list[dict]:
    stdout = stdout.strip()
    if not stdout:
        return []
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "result" in data:
        r = data["result"]
        return r if isinstance(r, list) else [r]
    return []


def main() -> int:
    names = parse_env(NAMES_FILE)
    test_env = parse_env(ROOT / ".env.test")
    prod_env = parse_env(ROOT / ".env.production")
    account_id = test_env.get("CF_ACCOUNT_ID") or prod_env.get("CF_ACCOUNT_ID")
    token = test_env.get("CF_API_TOKEN") or prod_env.get("CF_D1_ADMIN_TOKEN") or ""
    if not account_id:
        print("resolve-desk-cf-bindings: missing CF_ACCOUNT_ID in .env.test", file=sys.stderr)
        return 1

    d1_list = parse_wrangler_list(wrangler_run(["d1", "list", "--json"], account_id, token))
    d1_by_name = {row.get("name"): row.get("uuid") for row in d1_list if row.get("name")}

    kv_list = parse_wrangler_list(wrangler_run(["kv", "namespace", "list"], account_id, token))
    kv_by_title = {row.get("title"): row.get("id") for row in kv_list if row.get("title")}

    test_updates: dict[str, str] = {}
    prod_updates: dict[str, str] = {}

    d1_test = names.get("D1_DATABASE_NAME_TEST", "desk-control-test")
    d1_prod = names.get("D1_DATABASE_NAME", "desk-control")
    if d1_test in d1_by_name:
        test_updates["D1_DATABASE_ID_TEST"] = d1_by_name[d1_test]
    if d1_prod in d1_by_name:
        prod_updates["D1_DATABASE_ID"] = d1_by_name[d1_prod]

    kv_map_test = (
        ("KV_TENANT_CACHE_ID_TEST", names.get("KV_TENANT_CACHE_TITLE_TEST", "")),
        ("KV_TENANT_CACHE_PREVIEW_ID_TEST", names.get("KV_TENANT_CACHE_PREVIEW_TITLE_TEST", "")),
    )
    kv_map_prod = (
        ("KV_TENANT_CACHE_ID", names.get("KV_TENANT_CACHE_TITLE", "")),
        ("KV_TENANT_CACHE_PREVIEW_ID", names.get("KV_TENANT_CACHE_PREVIEW_TITLE", "")),
    )
    for env_key, title in kv_map_test:
        if title and title in kv_by_title:
            test_updates[env_key] = kv_by_title[title]
    for env_key, title in kv_map_prod:
        if title and title in kv_by_title:
            prod_updates[env_key] = kv_by_title[title]

    if test_updates:
        write_env(ROOT / ".env.test", test_updates)
        print("Updated .env.test:", ", ".join(test_updates.keys()))
    if prod_updates:
        write_env(ROOT / ".env.production", prod_updates)
        print("Updated .env.production:", ", ".join(prod_updates.keys()))

    missing = []
    if not test_updates.get("D1_DATABASE_ID_TEST") and d1_test not in d1_by_name:
        missing.append(f"D1 {d1_test} (wrangler d1 create {d1_test})")
    for label, title in [
        ("KV test", names.get("KV_TENANT_CACHE_TITLE_TEST", "")),
        ("KV test preview", names.get("KV_TENANT_CACHE_PREVIEW_TITLE_TEST", "")),
    ]:
        if title and title not in kv_by_title:
            missing.append(f"{label} title={title}")

    if missing:
        print("Desk resources not in account yet (Flatbase uses flatbase-control-test, not these):", file=sys.stderr)
        for m in missing:
            print(f"  - {m}", file=sys.stderr)
        print("Run: npm run cf:provision:test", file=sys.stderr)
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
