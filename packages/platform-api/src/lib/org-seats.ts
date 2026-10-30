import { PLAN_LIMITS, planFromSlug } from "@chatbot/domain";
import type { Env } from "../types";

export async function countOrgSeatUsage(
  env: Env,
  orgId: string,
): Promise<{ members: number; pendingInvites: number; total: number }> {
  const [members, pending] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM memberships WHERE org_id = ?`,
    )
      .bind(orgId)
      .first<{ n: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM member_invites
       WHERE org_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')`,
    )
      .bind(orgId)
      .first<{ n: number }>(),
  ]);
  const m = members?.n ?? 0;
  const p = pending?.n ?? 0;
  return { members: m, pendingInvites: p, total: m + p };
}

export async function assertSeatAvailable(
  env: Env,
  orgId: string,
  planSlug: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const usage = await countOrgSeatUsage(env, orgId);
  if (usage.total >= limits.maxSeats) {
    return { ok: false, code: "plan_seat_limit" };
  }
  return { ok: true };
}
