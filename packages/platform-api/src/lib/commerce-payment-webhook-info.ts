import type { Env } from "../types";
import {
  ensureOrgPaymentWebhookToken,
  paymentWebhookUrl,
} from "./commerce-webhook-token";

/** URL fija por tenant para webhooks de pasarelas conectadas vía Desk Integrations. */
export async function getOrgCommercePaymentWebhookInfo(
  env: Env,
  orgId: string,
): Promise<{ incomingUrl: string }> {
  const token = await ensureOrgPaymentWebhookToken(env, orgId);
  return { incomingUrl: paymentWebhookUrl(env, token) };
}

export async function attachPaymentWebhookToIntegrations<
  T extends { definition: { kind: string } },
>(env: Env, orgId: string, items: T[]): Promise<
  Array<
    T & {
      paymentWebhook?: { incomingUrl: string };
    }
  >
> {
  const hasPayment = items.some((i) => i.definition.kind === "payment");
  if (!hasPayment) return items;

  const paymentWebhook = await getOrgCommercePaymentWebhookInfo(env, orgId);
  return items.map((item) =>
    item.definition.kind === "payment"
      ? { ...item, paymentWebhook }
      : item,
  );
}
