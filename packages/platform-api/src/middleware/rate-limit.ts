import type { Env } from "../types";

export async function rateLimitPublic(
  env: Env,
  key: string,
  limit = 60,
  windowSec = 60,
): Promise<boolean> {
  const bucketKey = `rl:${key}`;
  const current = Number(await env.TENANT_CACHE.get(bucketKey)) || 0;
  if (current >= limit) return true;
  await env.TENANT_CACHE.put(bucketKey, String(current + 1), {
    expirationTtl: windowSec,
  });
  return false;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
