export type PlanSlug = "starter" | "growth" | "business";

export interface PlanLimits {
  slug: PlanSlug;
  monthlyAiCredits: number;
  monthlyMessages: number;
  /** Included panel users (owner counts toward the limit). */
  maxSeats: number;
  maxRagSources: number;
  maxOriginsPerBot: number;
  maxHttpToolsPerBot: number;
  maxMcpServersPerBot: number;
  /** MCP tools materialized in D1 catalog (not sent all to LLM). */
  maxMcpToolsMaterializedPerBot: number;
  maxConnectorsPerBot: number;
  maxOrgWebhooks: number;
  logRetentionDays: number;
  /** Shell / Computer dedicado (cola Enterprise, plan Business). */
  enterpriseShell: boolean;
}

/**
 * Planes diferencian **volumen y escala** (mensajes, créditos, equipo, integraciones).
 */
export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  starter: {
    slug: "starter",
    monthlyAiCredits: 50_000,
    monthlyMessages: 2_500,
    maxSeats: 3,
    maxRagSources: 20,
    maxOriginsPerBot: 3,
    maxHttpToolsPerBot: 12,
    maxMcpServersPerBot: 2,
    maxMcpToolsMaterializedPerBot: 64,
    maxConnectorsPerBot: 5,
    maxOrgWebhooks: 3,
    logRetentionDays: 30,
    enterpriseShell: false,
  },
  growth: {
    slug: "growth",
    monthlyAiCredits: 120_000,
    monthlyMessages: 12_000,
    maxSeats: 10,
    maxRagSources: 40,
    maxOriginsPerBot: 0,
    maxHttpToolsPerBot: 24,
    maxMcpServersPerBot: 4,
    maxMcpToolsMaterializedPerBot: 128,
    maxConnectorsPerBot: 10,
    maxOrgWebhooks: 5,
    logRetentionDays: 60,
    enterpriseShell: false,
  },
  business: {
    slug: "business",
    monthlyAiCredits: 480_000,
    monthlyMessages: 50_000,
    maxSeats: 35,
    maxRagSources: 120,
    maxOriginsPerBot: 0,
    maxHttpToolsPerBot: 48,
    maxMcpServersPerBot: 8,
    maxMcpToolsMaterializedPerBot: 256,
    maxConnectorsPerBot: 20,
    maxOrgWebhooks: 10,
    logRetentionDays: 90,
    enterpriseShell: true,
  },
};

export function planAllowsEnterpriseShell(limits: PlanLimits): boolean {
  return limits.enterpriseShell;
}

export function planFromSlug(slug: string): PlanSlug {
  if (slug === "starter" || slug === "growth" || slug === "business") return slug;
  return "starter";
}

/** Integraciones en vivo (HTTP, MCP, conectores) — disponibles en todos los planes (límites numéricos en PLAN_LIMITS). */
export function planAllowsIntegrations(limits: PlanLimits): boolean {
  return (
    limits.maxHttpToolsPerBot > 0 ||
    limits.maxMcpServersPerBot > 0 ||
    limits.maxConnectorsPerBot > 0
  );
}
