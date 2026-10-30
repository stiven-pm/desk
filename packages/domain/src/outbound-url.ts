const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[::1\]/,
  /^metadata\.google/i,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("url_protocol_not_allowed");
  }
  const host = u.hostname.toLowerCase();
  for (const re of BLOCKED_HOST_PATTERNS) {
    if (re.test(host)) throw new Error("url_host_blocked");
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("url_host_blocked");
  }
  return u;
}

/** El destino debe coincidir con el host declarado en base_url de la herramienta. */
export function assertUrlHostAllowed(requestUrl: URL, allowedBaseUrl: string): void {
  const base = assertPublicHttpUrl(allowedBaseUrl);
  if (requestUrl.hostname.toLowerCase() !== base.hostname.toLowerCase()) {
    throw new Error("url_host_mismatch");
  }
}
