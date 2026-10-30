import type { Env } from "../types";

export async function recordOrgAudit(
  env: Env,
  orgId: string,
  actorUserId: string | null,
  action: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (org_id, actor_user_id, action, meta_json)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(orgId, actorUserId, action, meta ? JSON.stringify(meta) : null)
    .run();
}
