import type { Env } from "../types";
import { randomId } from "./http";
import { notifyOwnersOrderPaid } from "./commerce-order-notify";
import { notifyCustomerPaymentResultInConversation } from "./commerce-payment-customer-notify";
import {
  clearStockReservationsForConversation,
  decrementStockForOrderLines,
} from "@chatbot/runtime/commerce/stock-reservations";

export type SalesOrderPayableRow = {
  id: string;
  status: string;
  lines_json: string;
  conversation_id: string;
};

export function parseOrderLines(
  linesJson: string,
): Array<{ productId: string; quantity: number }> {
  try {
    return JSON.parse(linesJson) as Array<{ productId: string; quantity: number }>;
  } catch {
    return [];
  }
}

/** Idempotent: marca pedido pagado, stock y notificaciones (webhook o reconciliación). */
export async function fulfillCommerceOrderPaid(
  env: Env,
  orgId: string,
  order: SalesOrderPayableRow,
  meta: { source: string; reference?: string; provider?: string; eventId?: string },
): Promise<{ ok: true; already: boolean } | { ok: false; code: string }> {
  if (order.status === "paid") {
    return { ok: true, already: true };
  }
  if (!["awaiting_payment", "pending_verification"].includes(order.status)) {
    return { ok: false, code: "order_not_payable" };
  }

  const eventId = (meta.eventId ?? `sync-${order.id}-${Date.now()}`).slice(0, 120);
  const provider = meta.provider ?? "declarative";

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sales_orders SET status = 'paid', updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
    ).bind(order.id, orgId),
    env.DB.prepare(
      `UPDATE payment_attempts SET status = 'paid', updated_at = datetime('now')
       WHERE order_id = ? AND org_id = ? AND status = 'pending'`,
    ).bind(order.id, orgId),
    env.DB.prepare(
      `INSERT INTO commerce_payment_webhook_events (id, org_id, provider, external_event_id, order_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(randomId(), orgId, provider, eventId, order.id),
    env.DB.prepare(
      `INSERT INTO commerce_events (id, org_id, name, meta_json)
       VALUES (?, ?, 'payment.sync_paid', ?)`,
    ).bind(
      randomId(),
      orgId,
      JSON.stringify({
        orderId: order.id,
        reference: meta.reference,
        source: meta.source,
      }),
    ),
  ]);

  const paidLines = parseOrderLines(order.lines_json);
  if (paidLines.length) {
    await decrementStockForOrderLines(env.DB, orgId, paidLines);
    await clearStockReservationsForConversation(
      env.DB,
      orgId,
      order.conversation_id,
    );
  }

  void notifyOwnersOrderPaid(env, orgId, order.id);
  await notifyCustomerPaymentResultInConversation(env, orgId, order.id, "paid");

  return { ok: true, already: false };
}
