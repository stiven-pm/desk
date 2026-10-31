import {
  parseCommerceManifest,
  parsePaymentWebhook,
  paymentProfileSchema,
  verifyPaymentWebhookAuth,
  type PaymentWebhookProvider,
} from "@chatbot/domain";
import type { Env } from "../types";
import { providerSecretsFromManifest } from "./commerce-webhook-token";
import { notifyCustomerPaymentResultInConversation } from "./commerce-payment-customer-notify";
import { clearStockReservationsForConversation } from "@chatbot/runtime/commerce/stock-reservations";
import {
  fulfillCommerceOrderPaid,
  parseOrderLines,
} from "./commerce-order-paid";

export async function applyCommercePaymentWebhook(
  env: Env,
  orgId: string,
  provider: PaymentWebhookProvider,
  body: unknown,
  headers: {
    bearerToken?: string | null;
    body?: unknown;
    eventChecksumHeader?: string | null;
  },
): Promise<{ ok: boolean; code: string; orderId?: string }> {
  const row = await env.DB.prepare(
    `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ manifest_json: string | null }>();

  const secrets = providerSecretsFromManifest(row?.manifest_json ?? null);
  const manifest = parseCommerceManifest(row?.manifest_json);

  if (manifest.confirmationMode !== "automatic") {
    return { ok: false, code: "manual_confirmation_mode" };
  }

  const auth = await verifyPaymentWebhookAuth({
    provider,
    secrets,
    bearerToken: headers.bearerToken,
    body: headers.body,
    eventChecksumHeader: headers.eventChecksumHeader,
  });
  if (!auth.ok) {
    return { ok: false, code: auth.code };
  }

  const declarativeProfile = await loadOrgDeclarativePaymentProfile(env, orgId);
  if (!declarativeProfile) {
    return { ok: false, code: "payment_profile_missing" };
  }

  const parsed = parsePaymentWebhook(provider, body, declarativeProfile);
  if (parsed.status === "ignored") {
    return { ok: true, code: "ignored" };
  }
  if (!parsed.orderReference) {
    return { ok: false, code: "missing_order_reference" };
  }

  if (parsed.status === "failed") {
    const ref = parsed.orderReference;
    const order = await env.DB.prepare(
      `SELECT id, status, lines_json, conversation_id FROM sales_orders
       WHERE org_id = ? AND (public_ref = ? OR id = ? OR summary LIKE ?)
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(orgId, ref, ref, `%${ref}%`)
      .first<{
        id: string;
        status: string;
        lines_json: string;
        conversation_id: string;
      }>();
    if (!order || order.status !== "awaiting_payment") {
      return { ok: true, code: "order_not_payable", orderId: order?.id };
    }
    let orderLines: Array<{ productId: string; quantity: number }> = [];
    orderLines = parseOrderLines(order.lines_json);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE sales_orders SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
      ).bind(order.id, orgId),
      env.DB.prepare(
        `UPDATE payment_attempts SET status = 'failed', updated_at = datetime('now')
         WHERE order_id = ? AND org_id = ? AND status = 'pending'`,
      ).bind(order.id, orgId),
    ]);
    if (orderLines.length) {
      await clearStockReservationsForConversation(
        env.DB,
        orgId,
        order.conversation_id,
      );
    }
    void notifyCustomerPaymentResultInConversation(env, orgId, order.id, "failed");
    return { ok: true, code: "failed", orderId: order.id };
  }

  if (parsed.status !== "paid") {
    return { ok: true, code: "ignored" };
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM commerce_payment_webhook_events
     WHERE org_id = ? AND provider = ? AND external_event_id = ?`,
  )
    .bind(orgId, provider, parsed.eventId)
    .first();
  if (existing) return { ok: true, code: "duplicate" };

  const ref = parsed.orderReference;
  const order = await env.DB.prepare(
    `SELECT id, status, lines_json, conversation_id FROM sales_orders
     WHERE org_id = ? AND (public_ref = ? OR id = ? OR summary LIKE ?)
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(orgId, ref, ref, `%${ref}%`)
    .first<{
      id: string;
      status: string;
      lines_json: string;
      conversation_id: string;
    }>();

  if (!order) return { ok: false, code: "order_not_found" };
  if (!["awaiting_payment", "pending_verification"].includes(order.status)) {
    return { ok: true, code: "order_not_payable", orderId: order.id };
  }

  const fulfilled = await fulfillCommerceOrderPaid(env, orgId, order, {
    source: "webhook",
    reference: ref,
    provider,
    eventId: parsed.eventId,
  });
  if (!fulfilled.ok) {
    return { ok: true, code: fulfilled.code, orderId: order.id };
  }
  return { ok: true, code: "paid", orderId: order.id };
}

async function loadOrgDeclarativePaymentProfile(env: Env, orgId: string) {
  const row = await env.DB.prepare(
    `SELECT d.payment_profile_json
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     JOIN org_payment_providers p ON p.org_id = i.org_id
     WHERE i.org_id = ? AND i.status = 'connected' AND d.kind = 'payment'
       AND p.provider = 'declarative' AND p.status = 'active'
     ORDER BY i.updated_at DESC LIMIT 1`,
  )
    .bind(orgId)
    .first<{ payment_profile_json: string | null }>();
  if (!row?.payment_profile_json?.trim()) return undefined;
  try {
    return paymentProfileSchema.parse(JSON.parse(row.payment_profile_json));
  } catch {
    return undefined;
  }
}
