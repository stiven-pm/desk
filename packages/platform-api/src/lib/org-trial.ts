import { isTrialExpired, orgServiceActive } from "@chatbot/domain";
import type { Env } from "../types";

export type OrgAccessRow = {
  status: string;
  trial_ends_at: string | null;
  plan_slug: string;
};

/** Expire trial → pending (needs paid plan). Idempotent. */
export async function expireOrgTrialIfNeeded(env: Env, orgId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT status, trial_ends_at FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<{ status: string; trial_ends_at: string | null }>();
  if (!row || row.status !== "trial") return;
  if (!isTrialExpired(row.trial_ends_at)) return;
  await env.DB.prepare(
    `UPDATE orgs SET status = 'pending', trial_ends_at = NULL WHERE id = ?`,
  )
    .bind(orgId)
    .run();
}

export async function loadOrgAccess(
  env: Env,
  orgId: string,
): Promise<OrgAccessRow | null> {
  await expireOrgTrialIfNeeded(env, orgId);
  return env.DB.prepare(
    `SELECT status, trial_ends_at, plan_slug FROM orgs WHERE id = ?`,
  )
    .bind(orgId)
    .first<OrgAccessRow>();
}

export function orgAllowsService(row: OrgAccessRow | null | undefined): boolean {
  if (!row) return false;
  return orgServiceActive(row.status, row.trial_ends_at);
}
