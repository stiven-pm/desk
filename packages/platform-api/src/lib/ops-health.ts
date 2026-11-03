import {
  ECONOMICS_FIXED_USD_PER_ORG,
  ECONOMICS_USD_PER_1K_CREDITS,
  creemFeeUsd,
  mean,
  percentilesFromValues,
  planFromSlug,
  type PlanSlug,
} from "@chatbot/domain";
import type { Env } from "../types";
import { fetchOpsOrgMetrics, fetchOpsPlatformOverview } from "./ops-economics";
import { getCloudflareBillingForOps } from "./cloudflare-billing";

export type OpsSignalRow = {
  id: string;
  created_at: string;
  severity: string;
  category: string;
  code: string;
  org_id: string | null;
  bot_id: string | null;
  conversation_id: string | null;
  request_id: string | null;
  duration_ms: number | null;
  credits: number | null;
  summary: string;
  detail_json: string;
  org_name?: string | null;
  org_slug?: string | null;
};

export type OpsTurnQuality = {
  sampleSize: number;
  creditsPerMessage: { mean: number | null; p50: number | null; p95: number | null };
  durationMs: { mean: number | null; p50: number | null; p95: number | null };
  degradedRatePct: number | null;
  windowDays: number;
};

function windowClause(days: number): string {
  return `datetime('now', '-${Math.min(90, Math.max(1, days))} days')`;
}

export async function fetchOpsTurnQuality(
  env: Env,
  opts?: { orgId?: string; windowDays?: number },
): Promise<OpsTurnQuality> {
  const windowDays = opts?.windowDays ?? 7;
  const since = windowClause(windowDays);
  const orgFilter = opts?.orgId ? " AND org_id = ?" : "";
  const binds: string[] = opts?.orgId ? [opts.orgId] : [];

  const rows = await env.DB.prepare(
    `SELECT duration_ms, credits_metered, degraded
     FROM ops_visitor_turns
     WHERE created_at >= ${since}${orgFilter}`,
  )
    .bind(...binds)
    .all<{ duration_ms: number; credits_metered: number; degraded: number }>();

  const list = rows.results ?? [];
  const credits = list.map((r) => r.credits_metered);
  const durations = list.map((r) => r.duration_ms);
  const cp = percentilesFromValues(credits, [50, 95]);
  const dp = percentilesFromValues(durations, [50, 95]);
  const degradedN = list.filter((r) => r.degraded === 1).length;

  return {
    sampleSize: list.length,
    windowDays,
    creditsPerMessage: {
      mean: mean(credits),
      p50: cp[50] ?? null,
      p95: cp[95] ?? null,
    },
    durationMs: {
      mean: mean(durations),
      p50: dp[50] ?? null,
      p95: dp[95] ?? null,
    },
    degradedRatePct:
      list.length > 0 ? Math.round((degradedN / list.length) * 1000) / 10 : null,
  };
}

export async function fetchOpsSignalEvents(
  env: Env,
  opts: {
    hours?: number;
    severity?: "error" | "warn" | "info";
    category?: string;
    orgId?: string;
    limit?: number;
  },
): Promise<OpsSignalRow[]> {
  const hours = Math.min(168, Math.max(1, opts.hours ?? 24));
  const limit = Math.min(200, Math.max(1, opts.limit ?? 80));
  const filters: string[] = [`e.created_at >= datetime('now', '-${hours} hours')`];
  const binds: (string | number)[] = [];

  if (opts.severity) {
    filters.push("e.severity = ?");
    binds.push(opts.severity);
  }
  if (opts.category) {
    filters.push("e.category = ?");
    binds.push(opts.category);
  }
  if (opts.orgId) {
    filters.push("e.org_id = ?");
    binds.push(opts.orgId);
  }
  binds.push(limit);

  const rows = await env.DB.prepare(
    `SELECT e.id, e.created_at, e.severity, e.category, e.code, e.org_id, e.bot_id,
            e.conversation_id, e.request_id, e.duration_ms, e.credits, e.summary, e.detail_json,
            o.name as org_name, o.slug as org_slug
     FROM ops_signal_events e
     LEFT JOIN orgs o ON o.id = e.org_id
     WHERE ${filters.join(" AND ")}
     ORDER BY e.created_at DESC
     LIMIT ?`,
  )
    .bind(...binds)
    .all<OpsSignalRow>();

  return rows.results ?? [];
}

export async function fetchOpsSignalCounts(
  env: Env,
  hours: number,
): Promise<{
  error: number;
  warn: number;
  byCategory: Array<{ category: string; error: number; warn: number }>;
}> {
  const h = Math.min(168, Math.max(1, hours));
  const totals = await env.DB.prepare(
    `SELECT severity, COUNT(*) as c
     FROM ops_signal_events
     WHERE created_at >= datetime('now', '-${h} hours')
     GROUP BY severity`,
  ).all<{ severity: string; c: number }>();

  let error = 0;
  let warn = 0;
  for (const r of totals.results ?? []) {
    if (r.severity === "error") error = r.c;
    if (r.severity === "warn") warn = r.c;
  }

  const byCat = await env.DB.prepare(
    `SELECT category, severity, COUNT(*) as c
     FROM ops_signal_events
     WHERE created_at >= datetime('now', '-${h} hours') AND severity IN ('error','warn')
     GROUP BY category, severity`,
  ).all<{ category: string; severity: string; c: number }>();

  const map = new Map<string, { error: number; warn: number }>();
  for (const r of byCat.results ?? []) {
    const cur = map.get(r.category) ?? { error: 0, warn: 0 };
    if (r.severity === "error") cur.error = r.c;
    else cur.warn = r.c;
    map.set(r.category, cur);
  }

  return {
    error,
    warn,
    byCategory: [...map.entries()].map(([category, v]) => ({ category, ...v })),
  };
}

export async function fetchOpsHealthOverview(env: Env) {
  const economics = await fetchOpsPlatformOverview(env);
  const orgs = await fetchOpsOrgMetrics(env);
  const active = orgs.filter((o) => o.status === "active");

  const costBand = ECONOMICS_USD_PER_1K_CREDITS.realisticAllIn;
  const variableUsd = economics.estimatedVariableCostUsd;
  const fixedUsd = active.reduce(
    (s, o) => s + ECONOMICS_FIXED_USD_PER_ORG[planFromSlug(o.plan_slug) as PlanSlug],
    0,
  );
  const creemUsd = creemFeeUsd(economics.mrrUsd);
  const totalCostUsd = variableUsd + fixedUsd + creemUsd;
  const grossUsd = economics.mrrUsd - totalCostUsd;
  const grossPct =
    economics.mrrUsd > 0 ? Math.round((grossUsd / economics.mrrUsd) * 1000) / 10 : 0;

  const turnQuality7d = await fetchOpsTurnQuality(env, { windowDays: 7 });
  const turnQuality24h = await fetchOpsTurnQuality(env, { windowDays: 1 });
  const signals24h = await fetchOpsSignalCounts(env, 24);
  const signals7d = await fetchOpsSignalCounts(env, 168);

  const usageFallback = active.filter((o) => o.messages_count > 0);
  let usageCreditsPerMsg: number | null = null;
  if (usageFallback.length) {
    const ratios = usageFallback.map(
      (o) => o.metered_credits / Math.max(1, o.messages_count),
    );
    usageCreditsPerMsg = mean(ratios);
  }

  const cfBilling = await getCloudflareBillingForOps(env);
  const estimatedCost = Math.round(totalCostUsd * 100) / 100;
  const infraEstimated =
    Math.round((variableUsd + fixedUsd) * 100) / 100;
  const cfActual = cfBilling.totalUsd;
  const reconciliation = {
    cloudflareUsdMtd: cfActual,
    deskInfraEstimatedUsdMtd: infraEstimated,
    deskTotalEstimatedUsdMtd: estimatedCost,
    creemEstimatedUsdMtd: Math.round(creemUsd * 100) / 100,
    deltaInfraUsd:
      cfActual != null
        ? Math.round((cfActual - infraEstimated) * 100) / 100
        : null,
    deltaInfraPct:
      cfActual != null && infraEstimated > 0
        ? Math.round(((cfActual - infraEstimated) / infraEstimated) * 1000) /
          10
        : null,
    deltaTotalUsd:
      cfActual != null
        ? Math.round((cfActual + creemUsd - estimatedCost) * 100) / 100
        : null,
    currency: cfBilling.currency,
    cfFetchedAt: cfBilling.fetchedAt,
    cfPeriodFrom: cfBilling.periodFrom,
    cfPeriodTo: cfBilling.periodTo,
    cfFetchError: cfBilling.fetchError,
    cfConfigured: cfBilling.configured,
    byFamily: cfBilling.byFamily,
  };

  return {
    economics: {
      ...economics,
      costBandUsdPer1kCredits: costBand,
      fixedInfraUsdMonth: Math.round(fixedUsd * 100) / 100,
      creemFeesUsdMonth: Math.round(creemUsd * 100) / 100,
      totalEstimatedCostUsdMonth: Math.round(totalCostUsd * 100) / 100,
      estimatedGrossUsdMonth: Math.round(grossUsd * 100) / 100,
      estimatedGrossMarginPct: grossPct,
      usageCreditsPerMessageMonthMean: usageCreditsPerMsg
        ? Math.round(usageCreditsPerMsg * 10) / 10
        : null,
    },
    turnQuality7d,
    turnQuality24h,
    signals24h,
    signals7d,
    costBands: ECONOMICS_USD_PER_1K_CREDITS,
    reconciliation,
  };
}

export async function fetchOpsOrgHealth(env: Env, orgId: string) {
  const turn7d = await fetchOpsTurnQuality(env, { orgId, windowDays: 7 });
  const events = await fetchOpsSignalEvents(env, { orgId, hours: 168, limit: 50 });
  const counts24h = await fetchOpsSignalCounts(env, 24);
  return { turn7d, recentEvents: events, signals24h: counts24h };
}
