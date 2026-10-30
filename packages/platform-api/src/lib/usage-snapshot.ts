import type { Env } from "../types";
import type { UsageSnapshot } from "./usage";
import { periodStartIso } from "./http";

export async function getUsage(env: Env, orgId: string): Promise<UsageSnapshot> {
  const period = periodStartIso();
  const row = await env.DB.prepare(
    `SELECT ai_credits_used, setup_credits_used, rag_meter_credits, messages_count, period_start
     FROM usage_counters WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{
      ai_credits_used: number;
      setup_credits_used: number;
      rag_meter_credits: number;
      messages_count: number;
      period_start: string;
    }>();
  if (!row || row.period_start !== period) {
    return {
      aiCreditsUsed: 0,
      setupCreditsUsed: 0,
      ragMeterCredits: 0,
      messagesCount: 0,
    };
  }
  return {
    aiCreditsUsed: row.ai_credits_used,
    setupCreditsUsed: row.setup_credits_used,
    ragMeterCredits: row.rag_meter_credits,
    messagesCount: row.messages_count,
  };
}
