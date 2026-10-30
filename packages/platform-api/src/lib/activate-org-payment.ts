import type { PlanSlug } from "@chatbot/domain";
import type { Env } from "../types";
import { applySubscriptionPayment } from "./fulfill-payment";

/** Idempotent: activate org or upgrade plan; marks pending payment paid. */
export async function activateOrgFromPayment(
  env: Env,
  input: {
    orgId: string;
    planSlug: PlanSlug;
    reference?: string | null;
    checkoutId?: string | null;
  },
): Promise<{ activated: boolean; alreadyActive: boolean }> {
  const r = await applySubscriptionPayment(env, input);
  return {
    activated: r.activated,
    alreadyActive: !r.activated && !r.upgraded,
  };
}
