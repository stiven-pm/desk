import type { Env } from "../types";

const CACHE_KEY = "account_mtd";

export type CfBillingFamilyRow = {
  family: string;
  usd: number;
  services: Array<{ name: string; usd: number }>;
};

export type CfBillingSnapshot = {
  configured: boolean;
  fetchedAt: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  currency: string;
  totalUsd: number | null;
  byFamily: CfBillingFamilyRow[];
  fetchError: string | null;
  source: "cache" | "live" | "none";
};

type RawRow = Record<string, unknown>;

function pickNum(row: RawRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function pickStr(row: RawRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function monthToDateRangeUtc(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const from = `${y}-${m}-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

function aggregateRows(rows: RawRow[]): {
  totalUsd: number;
  byFamily: CfBillingFamilyRow[];
  currency: string;
} {
  const familyMap = new Map<string, Map<string, number>>();
  let currency = "USD";
  let totalUsd = 0;

  for (const row of rows) {
    const cost = pickNum(row, "ContractedCost", "contractedCost", "BilledCost", "billedCost");
    if (cost <= 0) continue;
    totalUsd += cost;
    currency = pickStr(row, "BillingCurrency", "billingCurrency", "Currency") || currency;
    const family =
      pickStr(row, "ServiceFamilyName", "serviceFamilyName", "x_ProductFamilyId") ||
      "Other";
    const service =
      pickStr(row, "ServiceName", "serviceName", "ChargeDescription") || family;
    let services = familyMap.get(family);
    if (!services) {
      services = new Map();
      familyMap.set(family, services);
    }
    services.set(service, (services.get(service) ?? 0) + cost);
  }

  const byFamily: CfBillingFamilyRow[] = [...familyMap.entries()]
    .map(([family, services]) => {
      const serviceRows = [...services.entries()]
        .map(([name, usd]) => ({ name, usd: Math.round(usd * 100) / 100 }))
        .sort((a, b) => b.usd - a.usd);
      const usd = serviceRows.reduce((s, r) => s + r.usd, 0);
      return {
        family,
        usd: Math.round(usd * 100) / 100,
        services: serviceRows,
      };
    })
    .sort((a, b) => b.usd - a.usd);

  return {
    totalUsd: Math.round(totalUsd * 100) / 100,
    byFamily,
    currency,
  };
}

async function fetchBillableUsageV1(
  accountId: string,
  token: string,
  from: string,
  to: string,
): Promise<{ ok: true; rows: RawRow[] } | { ok: false; status: number; body: string }> {
  const url = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable-usage`,
  );
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 800) };
  }
  let parsed: { success?: boolean; result?: RawRow[]; errors?: unknown[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return { ok: false, status: res.status, body: "invalid_json" };
  }
  if (parsed.success === false) {
    return {
      ok: false,
      status: res.status,
      body: JSON.stringify(parsed.errors ?? parsed).slice(0, 800),
    };
  }
  return { ok: true, rows: parsed.result ?? [] };
}

async function fetchBillableUsageV2(
  accountId: string,
  token: string,
  from: string,
  to: string,
): Promise<{ ok: true; rows: RawRow[] } | { ok: false; status: number; body: string }> {
  const url = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/billable/usage`,
  );
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 800) };
  }
  let parsed: { success?: boolean; result?: RawRow[]; errors?: unknown[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return { ok: false, status: res.status, body: "invalid_json" };
  }
  if (parsed.success === false) {
    return {
      ok: false,
      status: res.status,
      body: JSON.stringify(parsed.errors ?? parsed).slice(0, 800),
    };
  }
  return { ok: true, rows: parsed.result ?? [] };
}

export function cloudflareBillingConfigured(env: Env): boolean {
  return Boolean(
    env.CF_ACCOUNT_ID?.trim() && env.CF_BILLING_API_TOKEN?.trim(),
  );
}

export async function syncCloudflareBillingCache(
  env: Env,
): Promise<CfBillingSnapshot> {
  const accountId = env.CF_ACCOUNT_ID?.trim();
  const token = env.CF_BILLING_API_TOKEN?.trim();
  const { from, to } = monthToDateRangeUtc();
  const fetchedAt = new Date().toISOString();

  if (!accountId || !token) {
    return {
      configured: false,
      fetchedAt: null,
      periodFrom: from,
      periodTo: to,
      currency: "USD",
      totalUsd: null,
      byFamily: [],
      fetchError: "billing_not_configured",
      source: "none",
    };
  }

  let rows: RawRow[] = [];
  let fetchError: string | null = null;

  const v1 = await fetchBillableUsageV1(accountId, token, from, to);
  if (v1.ok) {
    rows = v1.rows;
  } else {
    const v2 = await fetchBillableUsageV2(accountId, token, from, to);
    if (v2.ok) {
      rows = v2.rows;
    } else {
      fetchError = `cf_billing_http_${v1.status}: ${v1.body.slice(0, 200)}`;
    }
  }

  let totalUsd = 0;
  let byFamily: CfBillingFamilyRow[] = [];
  let currency = "USD";
  if (!fetchError) {
    const agg = aggregateRows(rows);
    totalUsd = agg.totalUsd;
    byFamily = agg.byFamily;
    currency = agg.currency;
  }

  await env.DB.prepare(
    `INSERT INTO ops_cf_billing_cache
     (cache_key, fetched_at, period_from, period_to, currency, total_usd, by_family_json, rows_json, fetch_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       fetched_at = excluded.fetched_at,
       period_from = excluded.period_from,
       period_to = excluded.period_to,
       currency = excluded.currency,
       total_usd = excluded.total_usd,
       by_family_json = excluded.by_family_json,
       rows_json = excluded.rows_json,
       fetch_error = excluded.fetch_error`,
  )
    .bind(
      CACHE_KEY,
      fetchedAt,
      from,
      to,
      currency,
      totalUsd,
      JSON.stringify(byFamily),
      JSON.stringify(rows.slice(0, 500)),
      fetchError,
    )
    .run();

  return {
    configured: true,
    fetchedAt,
    periodFrom: from,
    periodTo: to,
    currency,
    totalUsd: fetchError ? null : totalUsd,
    byFamily,
    fetchError,
    source: "live",
  };
}

export async function loadCloudflareBillingCache(
  env: Env,
): Promise<CfBillingSnapshot> {
  if (!cloudflareBillingConfigured(env)) {
    const { from, to } = monthToDateRangeUtc();
    return {
      configured: false,
      fetchedAt: null,
      periodFrom: from,
      periodTo: to,
      currency: "USD",
      totalUsd: null,
      byFamily: [],
      fetchError: "billing_not_configured",
      source: "none",
    };
  }

  const row = await env.DB.prepare(
    `SELECT fetched_at, period_from, period_to, currency, total_usd, by_family_json, fetch_error
     FROM ops_cf_billing_cache WHERE cache_key = ?`,
  )
    .bind(CACHE_KEY)
    .first<{
      fetched_at: string;
      period_from: string;
      period_to: string;
      currency: string;
      total_usd: number;
      by_family_json: string;
      fetch_error: string | null;
    }>();

  if (!row) {
    return {
      configured: true,
      fetchedAt: null,
      periodFrom: null,
      periodTo: null,
      currency: "USD",
      totalUsd: null,
      byFamily: [],
      fetchError: "no_cache_yet",
      source: "cache",
    };
  }

  let byFamily: CfBillingFamilyRow[] = [];
  try {
    byFamily = JSON.parse(row.by_family_json) as CfBillingFamilyRow[];
  } catch {
    byFamily = [];
  }

  return {
    configured: true,
    fetchedAt: row.fetched_at,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    currency: row.currency,
    totalUsd: row.fetch_error ? null : row.total_usd,
    byFamily,
    fetchError: row.fetch_error,
    source: "cache",
  };
}

export async function getCloudflareBillingForOps(
  env: Env,
  opts?: { refresh?: boolean },
): Promise<CfBillingSnapshot> {
  if (opts?.refresh) {
    return syncCloudflareBillingCache(env);
  }
  const cached = await loadCloudflareBillingCache(env);
  if (
    cached.configured &&
    cached.fetchedAt &&
    !cached.fetchError &&
    cached.totalUsd != null
  ) {
    const ageMs = Date.now() - Date.parse(cached.fetchedAt);
    if (ageMs < 6 * 60 * 60 * 1000) {
      return cached;
    }
  }
  if (cached.fetchError === "no_cache_yet" || cached.fetchError === "billing_not_configured") {
    if (cloudflareBillingConfigured(env)) {
      return syncCloudflareBillingCache(env);
    }
  }
  return cached;
}
