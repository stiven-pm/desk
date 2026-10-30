import type { Env } from "../types";

const FAIL_THRESHOLD = 5;
const OPEN_TTL_SECONDS = 60;

export async function isCircuitOpen(
  env: Env,
  tenantId: string,
  provider: string,
): Promise<boolean> {
  const key = `cb:${tenantId}:${provider}`;
  const val = await env.TENANT_CACHE.get(key);
  return val === "open";
}

export async function recordProviderFailure(
  env: Env,
  tenantId: string,
  provider: string,
): Promise<void> {
  const countKey = `cb:fail:${tenantId}:${provider}`;
  const current = Number(await env.TENANT_CACHE.get(countKey)) || 0;
  const next = current + 1;
  await env.TENANT_CACHE.put(countKey, String(next), { expirationTtl: 120 });
  if (next >= FAIL_THRESHOLD) {
    await env.TENANT_CACHE.put(`cb:${tenantId}:${provider}`, "open", {
      expirationTtl: OPEN_TTL_SECONDS,
    });
  }
}

export async function recordProviderSuccess(
  env: Env,
  tenantId: string,
  provider: string,
): Promise<void> {
  await env.TENANT_CACHE.delete(`cb:fail:${tenantId}:${provider}`);
  await env.TENANT_CACHE.delete(`cb:${tenantId}:${provider}`);
}
