import type { Env } from "../types";

export async function getIdempotentResponse(
  env: Env,
  orgId: string,
  key: string,
): Promise<Response | null> {
  const row = await env.DB.prepare(
    `SELECT status_code, body, expires_at FROM idempotency_keys
     WHERE org_id = ? AND key = ?`,
  )
    .bind(orgId, key)
    .first<{ status_code: number; body: string; expires_at: string }>();
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) return null;
  return new Response(row.body, {
    status: row.status_code,
    headers: { "Content-Type": "application/json" },
  });
}

export async function storeIdempotentResponse(
  env: Env,
  orgId: string,
  key: string,
  status: number,
  body: string,
): Promise<void> {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO idempotency_keys (key, org_id, status_code, body, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(org_id, key) DO UPDATE SET
       status_code = excluded.status_code,
       body = excluded.body,
       expires_at = excluded.expires_at`,
  )
    .bind(key, orgId, status, body, expires)
    .run();
}
