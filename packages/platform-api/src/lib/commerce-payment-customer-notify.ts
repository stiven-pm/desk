import type { Env } from "../types";

export type PaymentCustomerNotifyKind = "paid" | "failed";

function paymentResultMessage(
  publicRef: string,
  kind: PaymentCustomerNotifyKind,
): string {
  if (kind === "paid") {
    return (
      `*Pago confirmado* — pedido *${publicRef}*.\n\n` +
      `Gracias por tu compra. Si necesitas algo más, escríbenos aquí.`
    );
  }
  return (
    `No se completó el pago del pedido *${publicRef}*.\n\n` +
    `Puedes intentar de nuevo desde el carrito o pedir ayuda a un asesor.`
  );
}

/** Registra en el DO el resultado de pago para que la IA lo vea en el hilo web. */
export async function notifyCustomerPaymentResultInConversation(
  env: Env,
  orgId: string,
  orderId: string,
  kind: PaymentCustomerNotifyKind,
): Promise<void> {
  const order = await env.DB.prepare(
    `SELECT id, public_ref, conversation_id, summary FROM sales_orders
     WHERE id = ? AND org_id = ?`,
  )
    .bind(orderId, orgId)
    .first<{
      id: string;
      public_ref: string | null;
      conversation_id: string | null;
    }>();
  if (!order?.conversation_id) return;

  const conv = await env.DB.prepare(
    `SELECT phase FROM conversations WHERE id = ? AND org_id = ?`,
  )
    .bind(order.conversation_id, orgId)
    .first<{ phase: string }>();
  if (conv?.phase === "closed") return;

  const publicRef = order.public_ref?.trim() || order.id.slice(0, 8);
  const text = paymentResultMessage(publicRef, kind);

  const stub = env.CONVERSATION.getByName(`${orgId}:${order.conversation_id}`);
  await stub
    .fetch(
      new Request("http://do/record-assistant", {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    )
    .catch(() => undefined);
}
