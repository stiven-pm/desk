/** Copy visitante para pedidos nativos D1. */

import type { OrderRow } from "./native-order-lookup";

const STATUS_ES: Record<string, string> = {
  created: "registrado",
  awaiting_payment: "pendiente de pago",
  pending_verification: "pago en revisión",
  paid: "pagado",
  pending_fulfillment: "pagado, en preparación",
  fulfilled: "entregado",
  failed: "pago fallido",
  cancelled: "cancelado",
};

export function formatNativeOrderSacReplyForVisitor(
  order: OrderRow,
  opts?: { multipleMatches?: boolean },
): string {
  const ref = String(order.public_ref ?? order.id ?? "").trim();
  const status = String(order.status ?? "unknown");
  const statusLabel = STATUS_ES[status] ?? status;
  const summary = String(order.summary ?? "").trim();
  const created = String(order.created_at ?? "").trim();
  const datePart = created
    ? ` (${new Date(created).toLocaleDateString("es-CO")})`
    : "";
  const lines = summary ? ` Pedido: ${summary}.` : "";
  const multi = opts?.multipleMatches
    ? " Es el más reciente con esos datos; si buscas otro, pásame la referencia RK-."
    : "";
  return `Encontré el pedido ${ref || "en sistema"}${datePart}: estado ${statusLabel}.${lines}${multi} Si algo no cuadra, te ayudo a escalarlo con el equipo.`.trim();
}

export function formatNativeOrderNotFoundForVisitor(hint: string): string {
  return `No encontré un pedido con ${hint}. Si tienes la referencia RK-… compártela; si no, nombre, documento, fecha aproximada o qué pediste (productos y cantidades).`;
}
