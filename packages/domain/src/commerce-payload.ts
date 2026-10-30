export const COMMERCE_PAYLOAD_MAX_BYTES = 4096;
export const COMMERCE_PAYLOAD_MAX_KEYS = 32;

export function parseCommercePayloadKeysJson(
  raw: string | null | undefined,
): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((k): k is string => typeof k === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(k))
      .slice(0, 64);
  } catch {
    return null;
  }
}

export type CommercePayloadNormalizeResult =
  | { ok: true; payload?: Record<string, unknown> }
  | { ok: false; code: string };

export function normalizeCommercePayload(
  payload: Record<string, unknown> | undefined,
  allowedKeys: string[] | null,
): CommercePayloadNormalizeResult {
  if (!payload || Object.keys(payload).length === 0) {
    return { ok: true };
  }

  const keys = Object.keys(payload);
  if (keys.length > COMMERCE_PAYLOAD_MAX_KEYS) {
    return { ok: false, code: "payload_too_many_keys" };
  }

  const allowSet =
    allowedKeys && allowedKeys.length > 0 ? new Set(allowedKeys) : null;
  const out: Record<string, unknown> = {};

  for (const key of keys) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) {
      return { ok: false, code: "payload_invalid_key" };
    }
    if (allowSet && !allowSet.has(key)) {
      return { ok: false, code: "payload_key_not_allowed" };
    }
    const v = payload[key];
    if (!isSafeCommercePayloadValue(v)) {
      return { ok: false, code: "payload_invalid_value" };
    }
    out[key] = v;
  }

  const bytes = new TextEncoder().encode(JSON.stringify(out)).length;
  if (bytes > COMMERCE_PAYLOAD_MAX_BYTES) {
    return { ok: false, code: "payload_too_large" };
  }

  return { ok: true, payload: out };
}

function isSafeCommercePayloadValue(v: unknown, depth = 0): boolean {
  if (depth > 2) return false;
  if (v === null) return true;
  if (typeof v === "string") return v.length <= 2000;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) {
    return v.length <= 32 && v.every((x) => isSafeCommercePayloadValue(x, depth + 1));
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ks = Object.keys(o);
    return (
      ks.length <= 16 &&
      ks.every((k) => /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(k)) &&
      ks.every((k) => isSafeCommercePayloadValue(o[k], depth + 1))
    );
  }
  return false;
}
