#!/usr/bin/env bash
# Export only public build-time vars — never source full .env (secrets) into Next/OpenNext.
set -euo pipefail

_read_env_key() {
  local file="$1" key="$2"
  python3 - "$file" "$key" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
key = sys.argv[2]
if not path.is_file():
    sys.exit(2)
for line in path.read_text().splitlines():
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    if k.strip() == key:
        print(v.strip(), end="")
        sys.exit(0)
sys.exit(1)
PY
}

_env_file_for_target() {
  local target="$1" root="$2"
  case "$target" in
    test) echo "$root/.env.test" ;;
    production) echo "$root/.env.production" ;;
    *) echo "unknown target $target" >&2; return 1 ;;
  esac
}

_export_keys_from_env() {
  local file="$1"
  shift
  local key val
  for key in "$@"; do
    if val="$(_read_env_key "$file" "$key" 2>/dev/null)"; then
      export "$key=$val"
    fi
  done
}

_require_public_url() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "export_dashboard_build_env: missing $name in env file" >&2
    return 1
  fi
}

export_dashboard_build_env() {
  local target="${1:?target (test|production)}"
  local root="${2:?repo root}"
  local file
  file="$(_env_file_for_target "$target" "$root")"
  [[ -f "$file" ]] || { echo "missing $file" >&2; return 1; }

  _export_keys_from_env "$file" \
    NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_OPS_APP_URL \
    APP_URL \
    PLATFORM_API_URL

  # Fallbacks when only non-NEXT keys exist
  if [[ -z "${NEXT_PUBLIC_API_URL:-}" && -n "${PLATFORM_API_URL:-}" ]]; then
    export NEXT_PUBLIC_API_URL="$PLATFORM_API_URL"
  fi
  if [[ -z "${NEXT_PUBLIC_APP_URL:-}" && -n "${APP_URL:-}" ]]; then
    export NEXT_PUBLIC_APP_URL="$APP_URL"
  fi

  _require_public_url NEXT_PUBLIC_API_URL
  _require_public_url NEXT_PUBLIC_APP_URL
}

export_ops_build_env() {
  local target="${1:?target (test|production)}"
  local root="${2:?repo root}"
  local file
  file="$(_env_file_for_target "$target" "$root")"
  [[ -f "$file" ]] || { echo "missing $file" >&2; return 1; }

  _export_keys_from_env "$file" \
    NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_OPS_APP_URL \
    PLATFORM_API_URL \
    OPS_APP_URL

  if [[ -z "${NEXT_PUBLIC_API_URL:-}" && -n "${PLATFORM_API_URL:-}" ]]; then
    export NEXT_PUBLIC_API_URL="$PLATFORM_API_URL"
  fi
  if [[ -z "${NEXT_PUBLIC_OPS_APP_URL:-}" && -n "${OPS_APP_URL:-}" ]]; then
    export NEXT_PUBLIC_OPS_APP_URL="$OPS_APP_URL"
  fi

  _require_public_url NEXT_PUBLIC_API_URL
  _require_public_url NEXT_PUBLIC_OPS_APP_URL
}

# For deploy script echo lines only (no export to child builds)
print_deploy_urls() {
  local target="${1:?}" root="${2:?}"
  local file
  file="$(_env_file_for_target "$target" "$root")"
  local api desk ops
  api="$(_read_env_key "$file" PLATFORM_API_URL 2>/dev/null || true)"
  [[ -n "$api" ]] || api="$(_read_env_key "$file" NEXT_PUBLIC_API_URL 2>/dev/null || true)"
  desk="$(_read_env_key "$file" APP_URL 2>/dev/null || true)"
  [[ -n "$desk" ]] || desk="$(_read_env_key "$file" NEXT_PUBLIC_APP_URL 2>/dev/null || true)"
  ops="$(_read_env_key "$file" OPS_APP_URL 2>/dev/null || true)"
  [[ -n "$ops" ]] || ops="$(_read_env_key "$file" NEXT_PUBLIC_OPS_APP_URL 2>/dev/null || true)"
  echo "API:  ${api}"
  echo "Desk: ${desk}"
  echo "Ops:  ${ops}"
}
