import type { Env } from "../types";
export type SagaStep = "activate_org" | "warm_cache" | "notify";

export async function runProvisioningSaga(
  env: Env,
  orgId: string,
  steps: SagaStep[],
): Promise<void> {
  for (const step of steps) {
    try {
      if (step === "activate_org") {
        await env.DB.prepare(
          `UPDATE orgs SET status = 'active' WHERE id = ? AND status != 'active'`,
        )
          .bind(orgId)
          .run();
      }
      if (step === "warm_cache") {
        await env.TENANT_CACHE.put(`org:${orgId}:warmed`, "1", {
          expirationTtl: 300,
        });
      }
      if (step === "notify") {
        const { sendOnboardingWelcomeEmail } = await import("./onboarding-email");
        await sendOnboardingWelcomeEmail(env, orgId);
      }
    } catch (e) {
      await env.DB.prepare(
        `UPDATE orgs SET status = 'suspended' WHERE id = ?`,
      )
        .bind(orgId)
        .run();
      throw e;
    }
  }
}
