import type { PlanSlug } from "./plans";
import { PLAN_LIMITS, planFromSlug } from "./plans";
import { PLAN_MARKETING } from "./marketing";
import { RAG_METERING_CREDITS_PER_MESSAGE } from "./usage-metering";

export { RAG_METERING_CREDITS_PER_MESSAGE };

/** USD / 1k Desk credits — planning bands (see docs/COST_PER_MESSAGE.md). */
export const ECONOMICS_USD_PER_1K_CREDITS = {
  optimistic: 0.25,
  chatTokensOnly: 0.4,
  realisticAllIn: 0.7,
  pessimistic: 1.1,
} as const;

/** Fixed infra + payment processing per org / month (planning). */
export const ECONOMICS_FIXED_USD_PER_ORG: Record<PlanSlug, number> = {
  starter: 4.5,
  growth: 13,
  business: 40,
};

export const CREEM_FEE_RATE = 0.04;

export const WALLET_CREDIT_PACKS = {
  "25": { usd: 25, credits: 25_000, label: "25k créditos" },
  "50": { usd: 50, credits: 55_000, label: "55k créditos (+10%)" },
  "100": { usd: 100, credits: 120_000, label: "120k créditos (+20%)" },
} as const;

export type WalletPackId = keyof typeof WALLET_CREDIT_PACKS;

/** Suggested seat add-on USD/mes (not wired to Creem yet). */
export const SEAT_ADDON_USD: Record<PlanSlug, number | null> = {
  starter: null,
  growth: 12,
  business: 8,
};

export function planRetailUsd(slug: PlanSlug): number {
  return PLAN_MARKETING.find((p) => p.slug === slug)?.priceUsd ?? 0;
}

export function creemFeeUsd(mrrUsd: number): number {
  return mrrUsd * CREEM_FEE_RATE + 0.3;
}

export type OrgUsageSnapshot = {
  planSlug: PlanSlug;
  aiCreditsUsed: number;
  setupCreditsUsed: number;
  ragMeterCredits: number;
  messagesCount: number;
  walletBalance?: number;
};

export function totalMeteredCredits(u: OrgUsageSnapshot): number {
  return u.aiCreditsUsed + u.setupCreditsUsed + u.ragMeterCredits;
}

export function estimateVariableCostUsd(
  u: OrgUsageSnapshot,
  band: keyof typeof ECONOMICS_USD_PER_1K_CREDITS = "realisticAllIn",
): number {
  const rate = ECONOMICS_USD_PER_1K_CREDITS[band];
  return (totalMeteredCredits(u) / 1000) * rate;
}

export function estimateOrgGrossMarginUsd(
  u: OrgUsageSnapshot,
  band: keyof typeof ECONOMICS_USD_PER_1K_CREDITS = "realisticAllIn",
): {
  mrrUsd: number;
  variableUsd: number;
  fixedUsd: number;
  creemUsd: number;
  grossUsd: number;
  grossPct: number;
} {
  const slug = planFromSlug(u.planSlug);
  const mrrUsd = planRetailUsd(slug);
  const variableUsd = estimateVariableCostUsd(u, band);
  const fixedUsd = ECONOMICS_FIXED_USD_PER_ORG[slug];
  const creemUsd = creemFeeUsd(mrrUsd);
  const cost = variableUsd + fixedUsd + creemUsd;
  const grossUsd = mrrUsd - cost;
  const grossPct = mrrUsd > 0 ? (grossUsd / mrrUsd) * 100 : 0;
  return { mrrUsd, variableUsd, fixedUsd, creemUsd, grossUsd, grossPct };
}

export function usagePercentOfLimit(
  used: number,
  limit: number,
): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function orgLimits(slug: PlanSlug) {
  return PLAN_LIMITS[planFromSlug(slug)];
}
