import type { Env } from "../types";

const DELETION_GRACE_DAYS = 3;

export function deletionGraceDays(): number {
  return DELETION_GRACE_DAYS;
}

export async function purgeDueOrgDeletions(env: Env): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id FROM orgs
     WHERE deletion_scheduled_at IS NOT NULL
       AND deletion_scheduled_at <= datetime('now')`,
  ).all<{ id: string }>();

  let n = 0;
  for (const row of rows.results ?? []) {
    await env.DB.prepare(`DELETE FROM orgs WHERE id = ?`).bind(row.id).run();
    n += 1;
  }
  return n;
}

export async function orgDeletionBlocksLogin(
  env: Env,
  orgId: string,
): Promise<{ blocked: true; purgeAt: string } | { blocked: false }> {
  await purgeDueOrgDeletions(env);

  const row = await env.DB.prepare(
    `SELECT deletion_scheduled_at FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<{ deletion_scheduled_at: string | null }>();

  if (!row?.deletion_scheduled_at) return { blocked: false };

  return { blocked: true, purgeAt: row.deletion_scheduled_at };
}

export async function scheduleOrgDeletion(
  env: Env,
  orgId: string,
): Promise<string> {
  const purgeAt = await env.DB.prepare(
    `SELECT datetime('now', '+' || ? || ' days') AS at`,
  )
    .bind(String(DELETION_GRACE_DAYS))
    .first<{ at: string }>();

  const at = purgeAt?.at ?? new Date(Date.now() + DELETION_GRACE_DAYS * 864e5).toISOString();

  await env.DB.prepare(
    `UPDATE orgs SET deletion_scheduled_at = ? WHERE id = ?`,
  )
    .bind(at, orgId)
    .run();

  return at;
}
