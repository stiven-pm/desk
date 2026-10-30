import {
  PLAN_LIMITS,
  RAG_METERING_CREDITS_PER_MESSAGE,
  planFromSlug,
  type PlanSlug,
} from "@chatbot/domain";
import type { Env } from "../types";
import {
  assertCreditsWithWallet,
  getWalletBalance,
  recordCreditsWithWallet,
} from "./wallet";

export interface UsageSnapshot {
  aiCreditsUsed: number;
  setupCreditsUsed: number;
  ragMeterCredits: number;
  messagesCount: number;
}

import { getUsage as loadUsageSnapshot } from "./usage-snapshot";

export async function getUsage(env: Env, orgId: string): Promise<UsageSnapshot> {
  return loadUsageSnapshot(env, orgId);
}

function totalMetered(u: UsageSnapshot): number {
  return u.aiCreditsUsed + u.setupCreditsUsed + u.ragMeterCredits;
}

export async function assertWithinUsage(
  env: Env,
  orgId: string,
  planSlug: PlanSlug,
  delta: { credits?: number; messages?: number },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const usage = await getUsage(env, orgId);
  if (usage.messagesCount + (delta.messages ?? 0) > limits.monthlyMessages) {
    return { ok: false, code: "usage_messages_exceeded" };
  }
  const rag = delta.messages ? RAG_METERING_CREDITS_PER_MESSAGE : 0;
  const creditDelta = (delta.credits ?? 0) + rag;
  return assertCreditsWithWallet(
    env,
    orgId,
    planSlug,
    creditDelta,
    totalMetered(usage),
  );
}

export async function recordUsage(
  env: Env,
  orgId: string,
  planSlug: PlanSlug,
  delta: {
    credits?: number;
    messages?: number;
    setupCredits?: number;
  },
): Promise<void> {
  await recordCreditsWithWallet(env, orgId, planSlug, {
    chatCredits: delta.credits ?? 0,
    setupCredits: delta.setupCredits ?? 0,
    ragCredits: delta.messages ? RAG_METERING_CREDITS_PER_MESSAGE : 0,
    messages: delta.messages ?? 0,
  });
}

export async function getUsageWithWallet(env: Env, orgId: string, planSlug: PlanSlug) {
  const usage = await getUsage(env, orgId);
  const limits = PLAN_LIMITS[planFromSlug(planSlug)];
  const wallet = await getWalletBalance(env, orgId);
  return { usage, limits, wallet, metered: totalMetered(usage) };
}
