import {
  PLAN_LIMITS,
  RAG_METERING_CREDITS_PER_MESSAGE,
  planFromSlug,
  type PlanSlug,
} from "@chatbot/domain";

function periodStartIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

type UsageRow = {
  ai_credits_used: number;
  setup_credits_used: number;
  rag_meter_credits: number;
  messages_count: number;
  period_start: string;
};

async function loadUsage(
  db: D1Database,
  orgId: string,
  period: string,
): Promise<UsageRow> {
  const row = await db
    .prepare(
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

async function walletBalance(db: D1Database, orgId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT balance_credits FROM org_wallets WHERE org_id = ?`)
    .bind(orgId)
    .first<{ balance_credits: number }>();
  return row?.balance_credits ?? 0;
}

async function debitWallet(
  db: D1Database,
  orgId: string,
  credits: number,
): Promise<void> {
  if (credits <= 0) return;
  await db
    .prepare(
      `UPDATE org_wallets SET balance_credits = balance_credits - ?, updated_at = datetime('now')
       WHERE org_id = ? AND balance_credits >= ?`,
    )
    .bind(credits, orgId, credits)
    .run();
}

export async function assertOrgUsage(
  db: D1Database,
  orgId: string,
  planSlug: PlanSlug,
  delta: { credits?: number; messages?: number; ragCredits?: number },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const period = periodStartIso();
  const usage = await loadUsage(db, orgId, period);
  const rag = delta.ragCredits ?? RAG_METERING_CREDITS_PER_MESSAGE;
  const creditDelta = (delta.credits ?? 0) + (delta.messages ? rag : 0);

  if (usage.messages_count + (delta.messages ?? 0) > limits.monthlyMessages) {
    return { ok: false, code: "usage_messages_exceeded" };
  }

  const planRoom = limits.monthlyAiCredits - totalCredits(usage);
  if (creditDelta <= planRoom) return { ok: true };
  const walletNeed = creditDelta - Math.max(0, planRoom);
  const wallet = await walletBalance(db, orgId);
  if (wallet >= walletNeed) return { ok: true };
  return { ok: false, code: "usage_credits_exceeded" };
}

export async function recordOrgUsage(
  db: D1Database,
  orgId: string,
  planSlug: PlanSlug,
  delta: {
    credits?: number;
    messages?: number;
    setupCredits?: number;
    ragCredits?: number;
  },
): Promise<void> {
  const period = periodStartIso();
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const usage = await loadUsage(db, orgId, period);
  const rag =
    delta.ragCredits ??
    (delta.messages ? RAG_METERING_CREDITS_PER_MESSAGE : 0);
  const chat = delta.credits ?? 0;
  const setup = delta.setupCredits ?? 0;
  const totalDelta = chat + setup + rag;

  const planRoom = Math.max(0, limits.monthlyAiCredits - totalCredits(usage));
  const toPlan = Math.min(totalDelta, planRoom);
  const toWallet = totalDelta - toPlan;
  if (toWallet > 0) await debitWallet(db, orgId, toWallet);

  const planChat = Math.min(chat, toPlan);
  let remaining = toPlan - planChat;
  const planSetup = Math.min(setup, remaining);
  remaining -= planSetup;
  const planRag = Math.min(rag, remaining);

  await db
    .prepare(
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
