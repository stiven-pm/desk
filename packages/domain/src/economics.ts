/**
 * Planificación COGS Rekov — **nunca** exponer a tenants (solo Ops auth + docs internos).
 * Clientes ven precio del plan y cupos en marketing/billing, no margen ni coste Cloudflare.
 */
import type { PaidPlanSlug, PlanSlug } from "./plans";
import { PLAN_LIMITS, planFromSlug } from "./plans";
import { PLAN_MARKETING } from "./marketing";
import { RAG_METERING_CREDITS_PER_MESSAGE } from "./usage-metering";

export { RAG_METERING_CREDITS_PER_MESSAGE };

/**
 * USD / 1k Desk credits — calibrado a list price Cloudflare (GLM-5.3-Flash + BGE-M3).
 * Ver docs/COST_PER_MESSAGE.md y docs/UNIT_ECONOMICS.md.
 */
export const ECONOMICS_USD_PER_1K_CREDITS = {
  optimistic: 0.22,
  chatTokensOnly: 0.32,
  realisticAllIn: 0.45,
  pessimistic: 0.55,
  /** Solo alerta: 100% cupo créditos × rate — puede marcar Business negativo sin reflejar CF real. */
  linearCreditCeiling: 1.1,
} as const;

/** Fixed infra + payment processing per org / month (planning). */
export const ECONOMICS_FIXED_USD_PER_ORG: Record<PaidPlanSlug, number> = {
  starter: 4.5,
  growth: 13,
  business: 40,
};

/** Vectorize + plataforma compartida (planning stress), USD/mes por org. */
export const STRESS_VECTORIZE_USD_PER_ORG: Record<PaidPlanSlug, number> = {
  starter: 15,
  growth: 40,
  business: 120,
};

/**
 * Mensaje visitante pesado (6× GLM-5.3-Flash ~6k/1.8k tokens + RAG metered).
 * Alineado con TYPICAL heavy + escalera/tools — ver UNIT_ECONOMICS.md.
 */
export const STRESS_CREDITS_PER_VISITOR_MESSAGE = 34;

/** USD por mensaje visitante en escenario stress (solo LLM list price). */
export const STRESS_LLM_USD_PER_VISITOR_MESSAGE = 0.0108;

export const CREEM_FEE_RATE = 0.04;

export const WALLET_CREDIT_PACKS = {
  "25": { usd: 25, credits: 25_000, label: "25k créditos" },
  "50": { usd: 50, credits: 55_000, label: "55k créditos (+10%)" },
  "100": { usd: 100, credits: 120_000, label: "120k créditos (+20%)" },
} as const;

export type WalletPackId = keyof typeof WALLET_CREDIT_PACKS;

/** Suggested seat add-on USD/mes (not wired to Creem yet). */
export const SEAT_ADDON_USD: Record<PaidPlanSlug, number | null> = {
  starter: null,
  growth: 12,
  business: 8,
};

export function planRetailUsd(slug: PlanSlug): number {
  if (slug === "trial") return 0;
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

export function stressVisitorMessagesBeforeCreditCap(slug: PlanSlug): number {
  const limits = PLAN_LIMITS[planFromSlug(slug)];
  const per = Math.max(1, STRESS_CREDITS_PER_VISITOR_MESSAGE);
  return Math.min(
    limits.monthlyMessages,
    Math.floor(limits.monthlyAiCredits / per),
  );
}

/** Margen bruto si cada org activa quema cupo con mensajes “stress” (techo por créditos). */
export function estimatePlanStressMarginUsd(slug: PlanSlug): {
  mrrUsd: number;
  stressMessages: number;
  llmUsd: number;
  vectorizeUsd: number;
  fixedUsd: number;
  creemUsd: number;
  grossUsd: number;
  grossPct: number;
} {
  const plan = planFromSlug(slug);
  const mrrUsd = planRetailUsd(plan);
  const stressMessages = stressVisitorMessagesBeforeCreditCap(plan);
  const llmUsd = stressMessages * STRESS_LLM_USD_PER_VISITOR_MESSAGE;
  const vectorizeUsd = STRESS_VECTORIZE_USD_PER_ORG[plan as PaidPlanSlug] ?? STRESS_VECTORIZE_USD_PER_ORG.starter;
  const fixedUsd = ECONOMICS_FIXED_USD_PER_ORG[plan as PaidPlanSlug] ?? ECONOMICS_FIXED_USD_PER_ORG.starter;
  const creemUsd = creemFeeUsd(mrrUsd);
  const cost = llmUsd + vectorizeUsd + fixedUsd + creemUsd;
  const grossUsd = mrrUsd - cost;
  const grossPct = mrrUsd > 0 ? (grossUsd / mrrUsd) * 100 : 0;
  return {
    mrrUsd,
    stressMessages,
    llmUsd,
    vectorizeUsd,
    fixedUsd,
    creemUsd,
    grossUsd,
    grossPct,
  };
}

export const PLAN_STRESS_MARGINS: Record<
  PaidPlanSlug,
  ReturnType<typeof estimatePlanStressMarginUsd>
> = {
  starter: estimatePlanStressMarginUsd("starter"),
  growth: estimatePlanStressMarginUsd("growth"),
  business: estimatePlanStressMarginUsd("business"),
};

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
  const fixedUsd =
    slug === "trial"
      ? ECONOMICS_FIXED_USD_PER_ORG.starter
      : ECONOMICS_FIXED_USD_PER_ORG[slug];
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
