import {
  ECONOMICS_USD_PER_1K_CREDITS,
  estimateOrgGrossMarginUsd,
  estimateVariableCostUsd,
  orgLimits,
  planFromSlug,
  planRetailUsd,
  totalMeteredCredits,
  type OrgUsageSnapshot,
  type PlanSlug,
  usagePercentOfLimit,
} from "@chatbot/domain";
import type { Env } from "../types";
import { periodStartIso } from "./http";
import { getWalletBalance } from "./wallet";

export type OpsOrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_slug: string;
  status: string;
  created_at: string;
  ai_credits_used: number;
  setup_credits_used: number;
  rag_meter_credits: number;
  messages_count: number;
  wallet_balance: number;
  bots_count: number;
  sources_count: number;
  mrr_usd: number;
  metered_credits: number;
  pct_messages: number;
  pct_credits: number;
  variable_cost_usd: number;
  gross_margin_usd: number;
  gross_margin_pct: number;
};

export async function fetchOpsOrgMetrics(env: Env): Promise<OpsOrgRow[]> {
  const period = periodStartIso();
  const rows = await env.DB.prepare(
    `SELECT o.id, o.name, o.slug, o.plan_slug, o.status, o.created_at,
            COALESCE(u.ai_credits_used, 0) as ai_credits_used,
            COALESCE(u.setup_credits_used, 0) as setup_credits_used,
            COALESCE(u.rag_meter_credits, 0) as rag_meter_credits,
            COALESCE(u.messages_count, 0) as messages_count,
            (SELECT COUNT(*) FROM bots b WHERE b.org_id = o.id) as bots_count,
            (SELECT COUNT(*) FROM sources s WHERE s.org_id = o.id) as sources_count
     FROM orgs o
     LEFT JOIN usage_counters u ON u.org_id = o.id AND u.period_start = ?
     ORDER BY o.created_at DESC
     LIMIT 500`,
  )
    .bind(period)
    .all<{
      id: string;
      name: string;
      slug: string;
      plan_slug: string;
      status: string;
      created_at: string;
      ai_credits_used: number;
      setup_credits_used: number;
      rag_meter_credits: number;
      messages_count: number;
      bots_count: number;
      sources_count: number;
    }>();

  const out: OpsOrgRow[] = [];
  for (const r of rows.results ?? []) {
    const slug = planFromSlug(r.plan_slug) as PlanSlug;
    const wallet = await getWalletBalance(env, r.id);
    const snap: OrgUsageSnapshot = {
      planSlug: slug,
      aiCreditsUsed: r.ai_credits_used,
      setupCreditsUsed: r.setup_credits_used,
      ragMeterCredits: r.rag_meter_credits,
      messagesCount: r.messages_count,
      walletBalance: wallet,
    };
    const limits = orgLimits(slug);
    const margin = estimateOrgGrossMarginUsd(snap, "realisticAllIn");
    out.push({
      ...r,
      wallet_balance: wallet,
      mrr_usd: planRetailUsd(slug),
      metered_credits: totalMeteredCredits(snap),
      pct_messages: usagePercentOfLimit(
        r.messages_count,
        limits.monthlyMessages,
      ),
      pct_credits: usagePercentOfLimit(
        totalMeteredCredits(snap),
        limits.monthlyAiCredits,
      ),
      variable_cost_usd: estimateVariableCostUsd(snap, "realisticAllIn"),
      gross_margin_usd: margin.grossUsd,
      gross_margin_pct: Math.round(margin.grossPct),
    });
  }
  return out;
}

export async function fetchOpsPlatformOverview(env: Env) {
  const orgs = await fetchOpsOrgMetrics(env);
  const active = orgs.filter((o) => o.status === "active");
  const mrr = active.reduce((s, o) => s + o.mrr_usd, 0);
  const variable = active.reduce((s, o) => s + o.variable_cost_usd, 0);
  const messages = active.reduce((s, o) => s + o.messages_count, 0);
  const credits = active.reduce((s, o) => s + o.metered_credits, 0);
  return {
    orgCount: orgs.length,
    activeOrgCount: active.length,
    mrrUsd: mrr,
    meteredCreditsMonth: credits,
    messagesMonth: messages,
    estimatedVariableCostUsd: variable,
    costBands: ECONOMICS_USD_PER_1K_CREDITS,
    note:
      "Costes variables usan banda realisticAllIn ($0.70/1k créditos medidos). Vectorize global puede subir la realidad — ver docs/COST_PER_MESSAGE.md.",
  };
}
