import type { Env } from "../types";

export function isPublicOriginAllowed(
  env: Env,
  allowedOrigins: string[],
  origin: string,
): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (allowedOrigins.some((o) => o.replace(/\/$/, "") === normalized)) {
    return true;
  }
  const appUrl = env.APP_URL?.trim().replace(/\/$/, "");
  if (appUrl && normalized === appUrl) return true;
  return false;
}
