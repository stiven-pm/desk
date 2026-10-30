/** Prevent open redirects after login (pattern from Flatbase). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  return next;
}
