import type { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  verifyCreemWebhookSignature,
  walletPackFromCreemProductId,
} from "../lib/creem";
import {
  applySubscriptionPayment,
  fulfillPendingPayment,
  fulfillWalletPackPayment,
  type PendingPaymentRow,
} from "../lib/fulfill-payment";
import { json, apiError } from "../lib/http";
import { planFromSlug } from "@chatbot/domain";
import { resolveOrgByPaymentWebhookToken } from "../lib/commerce-webhook-token";
import { applyCommercePaymentWebhook } from "../lib/commerce-payment-webhook-handler";
import type { PaymentWebhookProvider } from "@chatbot/domain";

type CreemWebhookPayload = {
  eventType?: string;
  type?: string;
  object?: {
    id?: string;
    request_id?: string;
    product_id?: string;
    metadata?: { org_id?: string; plan_slug?: string };
    checkout_id?: string;
  };
  data?: {
    id?: string;
    request_id?: string;
    product_id?: string;
    metadata?: { org_id?: string; plan_slug?: string };
    checkout_id?: string;
  };
};

const ACTIVATE_EVENTS = new Set([
  "checkout.completed",
  "subscription.active",
  "subscription.paid",
  "checkout.paid",
  "payment.completed",
]);

function eventTypeOf(body: CreemWebhookPayload): string {
  return body.eventType ?? body.type ?? "";
}

function objectOf(body: CreemWebhookPayload) {
  return body.object ?? body.data;
}

export function registerWebhookRoutes(app: Hono<AppEnv>): void {
  app.post("/webhooks/creem", async (c) => {
    const secret = c.env.CREEM_WEBHOOK_SECRET;
    if (!secret) return apiError("not_configured", 503);

    const raw = await c.req.text();
    const sig =
      c.req.header("creem-signature") ?? c.req.header("x-creem-signature");
    const valid = await verifyCreemWebhookSignature(raw, sig ?? null, secret);
    if (!valid) return apiError("invalid_signature", 401);

    const body = JSON.parse(raw) as CreemWebhookPayload;
    const eventType = eventTypeOf(body);
    const object = objectOf(body);

    const legacyPaid =
      eventType.includes("paid") || eventType.includes("completed");
    if (!ACTIVATE_EVENTS.has(eventType) && !legacyPaid) {
      return json({ received: true, ignored: eventType || "unknown" });
    }

    const requestId = object?.request_id;
    const checkoutId = object?.checkout_id ?? object?.id;
    const productId = object?.product_id;

    if (requestId) {
      const payment = await c.env.DB.prepare(
        `SELECT id, org_id, creem_checkout_id, plan_slug, status, reference,
                payment_kind, wallet_pack
         FROM pending_payments WHERE reference = ?`,
      )
        .bind(requestId)
        .first<PendingPaymentRow>();

      if (payment) {
        if (payment.status === "paid") {
          return json({ received: true, action: "already_processed" });
        }
        const r = await fulfillPendingPayment(c.env, payment, checkoutId);
        return json({
          received: true,
          kind: r.kind,
          orgId: payment.org_id,
        });
      }
    }

    const walletPack = productId
      ? walletPackFromCreemProductId(c.env, productId)
      : null;
    const orgId = object?.metadata?.org_id;
    if (walletPack && orgId) {
      await fulfillWalletPackPayment(c.env, {
        orgId,
        pack: walletPack,
        reference: requestId,
        checkoutId,
      });
      return json({ received: true, kind: "wallet", orgId });
    }

    if (!orgId) return json({ received: true, ignored: "no_org" });

    await applySubscriptionPayment(c.env, {
      orgId,
      planSlug: planFromSlug(object?.metadata?.plan_slug ?? "starter"),
      reference: requestId,
      checkoutId,
    });

    return json({ received: true, kind: "subscription", orgId });
  });

  app.post("/webhooks/commerce-payments/:token/declarative", async (c) => {
    const token = c.req.param("token");
    const provider: PaymentWebhookProvider = "declarative";
    const org = await resolveOrgByPaymentWebhookToken(c.env, token);
    if (!org) return apiError("not_found", 404);

    const rawBody = await c.req.text();
    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return apiError("invalid_body", 400);
    }

    const result = await applyCommercePaymentWebhook(
      c.env,
      org.orgId,
      provider,
      body,
      {
        bearerToken: c.req.header("authorization"),
        body,
        eventChecksumHeader: c.req.header("x-event-checksum"),
      },
    );

    if (
      !result.ok &&
      (result.code === "invalid_signature" ||
        result.code === "provider_secret_not_configured")
    ) {
      return apiError(result.code, result.code === "invalid_signature" ? 401 : 503);
    }
    if (!result.ok && result.code === "order_not_found") {
      return json({ received: true, code: result.code }, 202);
    }
    return json({ received: true, code: result.code, orderId: result.orderId });
  });

  app.post("/webhooks/sources/:connector", async (c) => {
    const connector = c.req.param("connector");
    const body = await c.req.text();
    console.log(
      JSON.stringify({
        level: "info",
        event: "source_webhook",
        connector,
        bytes: body.length,
      }),
    );
    return json({ queued: true });
  });
}
