import type { PlanSlug } from "@chatbot/domain";
import { PLAN_LIMITS, planFromSlug } from "@chatbot/domain";
import type { Env } from "../types";
import { randomId, periodStartIso } from "./http";

type UsageRow = {
  ai_credits_used: number;
  setup_credits_used: number;
  rag_meter_credits: number;
  messages_count: number;
  period_start: string;
};

async function loadUsage(env: Env, orgId: string, period: string): Promise<UsageRow> {
  const row = await env.DB.prepare(
    `SELECT ai_credits_used, setup_credits_used, rag_meter_credits, messages_count, period_start
     FROM usage_counters WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<UsageRow>();
  if (!row || row.period_start !== period) {
    return {
      ai_credits_used: 0,
      setup_credits_used: 0,
      rag_meter_credits: 0,
      messages_count: 0,
      period_start: period,
    };
  }
  return row;
}

function totalCredits(r: UsageRow): number {
  return r.ai_credits_used + r.setup_credits_used + r.rag_meter_credits;
}

export async function getWalletBalance(env: Env, orgId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT balance_credits FROM org_wallets WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ balance_credits: number }>();
  return row?.balance_credits ?? 0;
}

export async function creditWallet(
  env: Env,
  params: {
    orgId: string;
    credits: number;
    kind: string;
    usdCents?: number;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const id = randomId();
  const purchased = params.kind.includes("purchase") ? params.credits : 0;
  await env.DB.prepare(
    `INSERT INTO org_wallets (org_id, balance_credits, lifetime_purchased_credits)
     VALUES (?, ?, ?)
     ON CONFLICT(org_id) DO UPDATE SET
       balance_credits = balance_credits + excluded.balance_credits,
       lifetime_purchased_credits = lifetime_purchased_credits + excluded.lifetime_purchased_credits,
       updated_at = datetime('now')`,
  )
    .bind(params.orgId, params.credits, purchased)
    .run();
  await env.DB.prepare(
    `INSERT INTO wallet_ledger (id, org_id, delta_credits, kind, usd_cents, meta_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      params.orgId,
      params.credits,
      params.kind,
      params.usdCents ?? null,
      params.meta ? JSON.stringify(params.meta) : null,
    )
    .run();
}

async function debitWallet(env: Env, orgId: string, credits: number): Promise<void> {
  if (credits <= 0) return;
  await env.DB.prepare(
    `UPDATE org_wallets SET balance_credits = balance_credits - ?, updated_at = datetime('now')
     WHERE org_id = ? AND balance_credits >= ?`,
  )
    .bind(credits, orgId, credits)
    .run();
  await env.DB.prepare(
    `INSERT INTO wallet_ledger (id, org_id, delta_credits, kind)
     VALUES (?, ?, ?, 'consumption')`,
  )
    .bind(randomId(), orgId, -credits)
    .run();
}

export async function assertCreditsWithWallet(
  env: Env,
  orgId: string,
  planSlug: PlanSlug,
  deltaCredits: number,
  currentMetered: number,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const planRoom = limits.monthlyAiCredits - currentMetered;
  if (deltaCredits <= planRoom) return { ok: true };
  const fromWallet = deltaCredits - Math.max(0, planRoom);
  const wallet = await getWalletBalance(env, orgId);
  if (wallet >= fromWallet) return { ok: true };
  return { ok: false, code: "usage_credits_exceeded" };
}

export async function recordCreditsWithWallet(
  env: Env,
  orgId: string,
  planSlug: PlanSlug,
  delta: {
    chatCredits?: number;
    setupCredits?: number;
    ragCredits?: number;
    messages?: number;
  },
): Promise<void> {
  const period = periodStartIso();
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const usage = await loadUsage(env, orgId, period);
  const chat = delta.chatCredits ?? 0;
  const setup = delta.setupCredits ?? 0;
  const rag = delta.ragCredits ?? 0;
  const totalDelta = chat + setup + rag;

  const planRoom = Math.max(0, limits.monthlyAiCredits - totalCredits(usage));
  const toPlan = Math.min(totalDelta, planRoom);
  const toWallet = totalDelta - toPlan;
  if (toWallet > 0) await debitWallet(env, orgId, toWallet);

  let remaining = toPlan;
  const planChat = Math.min(chat, remaining);
  remaining -= planChat;
  const planSetup = Math.min(setup, remaining);
  remaining -= planSetup;
  const planRag = Math.min(rag, remaining);

  await env.DB.prepare(
    `INSERT INTO usage_counters (org_id, period_start, ai_credits_used, messages_count, setup_credits_used, rag_meter_credits)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(org_id) DO UPDATE SET
       period_start = excluded.period_start,
       ai_credits_used = CASE WHEN usage_counters.period_start = excluded.period_start
         THEN usage_counters.ai_credits_used + excluded.ai_credits_used
         ELSE excluded.ai_credits_used END,
       messages_count = CASE WHEN usage_counters.period_start = excluded.period_start
         THEN usage_counters.messages_count + excluded.messages_count
         ELSE excluded.messages_count END,
       setup_credits_used = CASE WHEN usage_counters.period_start = excluded.period_start
         THEN usage_counters.setup_credits_used + excluded.setup_credits_used
         ELSE excluded.setup_credits_used END,
       rag_meter_credits = CASE WHEN usage_counters.period_start = excluded.period_start
         THEN usage_counters.rag_meter_credits + excluded.rag_meter_credits
         ELSE excluded.rag_meter_credits END,
       updated_at = datetime('now')`,
  )
    .bind(
      orgId,
      period,
      planChat,
      delta.messages ?? 0,
      planSetup,
      planRag,
    )
    .run();
}
