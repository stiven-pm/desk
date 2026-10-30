/** Origen permitido para postMessage al parent (embed en la web del cliente). */

export function normalizeOriginPattern(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

export function isAllowedPostMessageOrigin(
  targetOrigin: string,
  allowed: string[],
): boolean {
  if (!allowed.length) return false;
  const t = normalizeOriginPattern(targetOrigin);
  return allowed.some((a) => normalizeOriginPattern(a) === t);
}

/** Elige targetOrigin seguro; nunca devuelve "*" si hay allowlist. */
export function resolvePostMessageTarget(
  allowed: string[],
  referrer?: string,
): string | null {
  const list = allowed.map(normalizeOriginPattern).filter(Boolean);
  if (!list.length) return null;
  if (referrer) {
    try {
      const ref = normalizeOriginPattern(new URL(referrer).origin);
      if (list.includes(ref)) return ref;
    } catch {
      /* ignore */
    }
  }
  return list[0];
}
