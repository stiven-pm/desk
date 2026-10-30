import { VISITOR_QTY_MAX } from "./visitor-quantity";
import {
  STOCK_CHECKOUT_EXTEND_MINUTES,
  STOCK_RESERVE_TTL_MINUTES,
} from "./stock-availability";

const RESERVE_TTL_MINUTES = STOCK_RESERVE_TTL_MINUTES;

function capReservationQty(
  lines: Array<{ productId: string; quantity: number }>,
  productId: string,
  qty: number,
): number {
  const lineCap = Math.min(VISITOR_QTY_MAX, Math.max(1, Math.round(qty) || 1));
  const other = lines
    .filter((l) => l.productId !== productId)
    .reduce((n, l) => n + l.quantity, 0);
  return Math.min(lineCap, Math.max(0, VISITOR_QTY_MAX - other));
}

export async function purgeExpiredStockReservations(
  db: D1Database,
  orgId: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM stock_reservations
       WHERE org_id = ? AND expires_at < datetime('now')`,
    )
    .bind(orgId)
    .run();
}

export async function reservedQtyForProduct(
  db: D1Database,
  orgId: string,
  productId: string,
  excludeConversationId?: string,
): Promise<number> {
  await purgeExpiredStockReservations(db, orgId);
  const row = excludeConversationId
    ? await db
        .prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_reservations
           WHERE org_id = ? AND product_id = ? AND conversation_id != ?`,
        )
        .bind(orgId, productId, excludeConversationId)
        .first<{ n: number }>()
    : await db
        .prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_reservations
           WHERE org_id = ? AND product_id = ?`,
        )
        .bind(orgId, productId)
        .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function syncStockReservationsForCart(args: {
  db: D1Database;
  orgId: string;
  conversationId: string;
  lines: Array<{ productId: string; quantity: number }>;
}): Promise<void> {
  const { db, orgId, conversationId, lines } = args;
  await purgeExpiredStockReservations(db, orgId);
  await db
    .prepare(
      `DELETE FROM stock_reservations WHERE org_id = ? AND conversation_id = ?`,
    )
    .bind(orgId, conversationId)
    .run();
  const expiresAt = new Date(
    Date.now() + RESERVE_TTL_MINUTES * 60_000,
  ).toISOString();
  for (const line of lines) {
    const qty = capReservationQty(lines, line.productId, line.quantity);
    if (qty < 1) continue;
    await db
      .prepare(
        `INSERT INTO stock_reservations (id, org_id, product_id, conversation_id, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        orgId,
        line.productId,
        conversationId,
        qty,
        expiresAt,
      )
      .run();
  }
}

export async function clearStockReservationsForConversation(
  db: D1Database,
  orgId: string,
  conversationId: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM stock_reservations WHERE org_id = ? AND conversation_id = ?`,
    )
    .bind(orgId, conversationId)
    .run();
}

/** Al iniciar checkout, alarga la reserva de esta conversación para que no la quiten mid-pago. */
export async function extendStockReservationsForConversation(
  db: D1Database,
  orgId: string,
  conversationId: string,
  extraMinutes = STOCK_CHECKOUT_EXTEND_MINUTES,
): Promise<void> {
  await purgeExpiredStockReservations(db, orgId);
  const expiresAt = new Date(
    Date.now() + extraMinutes * 60_000,
  ).toISOString();
  await db
    .prepare(
      `UPDATE stock_reservations
       SET expires_at = ?
       WHERE org_id = ? AND conversation_id = ?`,
    )
    .bind(expiresAt, orgId, conversationId)
    .run();
}

type CartLineQty = { productId: string; quantity: number };

/** Resta stock al confirmar pedido (checkout / CO manual). Revierte con restoreStockForOrderLines si falla el pago. */
export async function decrementStockForOrderLines(
  db: D1Database,
  orgId: string,
  lines: CartLineQty[],
): Promise<{ ok: true } | { ok: false; productId: string }> {
  const applied: CartLineQty[] = [];
  for (const line of lines) {
    const qty = Math.min(99, Math.max(1, Math.round(line.quantity) || 1));
    const row = await db
      .prepare(
        `SELECT stock_qty FROM products
         WHERE org_id = ? AND id = ? AND status = 'published'`,
      )
      .bind(orgId, line.productId)
      .first<{ stock_qty: number | null }>();
    if (row?.stock_qty == null) continue;
    const result = await db
      .prepare(
        `UPDATE products
         SET stock_qty = stock_qty - ?
         WHERE org_id = ? AND id = ? AND status = 'published'
           AND stock_qty IS NOT NULL AND stock_qty >= ?`,
      )
      .bind(qty, orgId, line.productId, qty)
      .run();
    if ((result.meta.changes ?? 0) < 1) {
      for (const prev of applied) {
        await restoreStockForOrderLines(db, orgId, [prev]);
      }
      return { ok: false, productId: line.productId };
    }
    applied.push({ productId: line.productId, quantity: qty });
  }
  return { ok: true };
}

export async function restoreStockForOrderLines(
  db: D1Database,
  orgId: string,
  lines: CartLineQty[],
): Promise<void> {
  for (const line of lines) {
    const qty = Math.min(99, Math.max(1, Math.round(line.quantity) || 1));
    await db
      .prepare(
        `UPDATE products
         SET stock_qty = stock_qty + ?
         WHERE org_id = ? AND id = ? AND status = 'published'
           AND stock_qty IS NOT NULL`,
      )
      .bind(qty, orgId, line.productId)
      .run();
  }
}
