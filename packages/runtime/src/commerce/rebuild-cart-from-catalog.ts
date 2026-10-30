import type { CommerceCart, CommerceCartLine } from "@chatbot/domain";
import { getPublishedProduct, chatCatalogTitle } from "./native-catalog";
import { reservedQtyForProduct } from "./stock-reservations";

export function sanitizeLineNotes(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 400);
  return cleaned || undefined;
}

export function cartFingerprint(cart: CommerceCart): string {
  const parts = cart.lines
    .map(
      (l) =>
        `${l.productId}:${l.quantity}:${sanitizeLineNotes(l.lineNotes) ?? ""}:${l.priceCents}`,
    )
    .sort();
  return parts.join("|");
}

export type RebuildCartResult =
  | { ok: true; cart: CommerceCart; priceChanged: boolean }
  | { ok: false; code: string; productId?: string };

export async function rebuildCartFromCatalog(args: {
  cart: CommerceCart;
  db: D1Database | undefined;
  orgId: string;
  hasNativeCatalog: boolean;
  conversationId?: string;
}): Promise<RebuildCartResult> {
  const { cart, db, orgId, hasNativeCatalog, conversationId } = args;
  if (!cart.lines.length) {
    return { ok: false, code: "cart_empty" };
  }

  let priceChanged = false;
  const lines: CommerceCartLine[] = [];

  for (const line of cart.lines) {
    const qty = Math.min(99, Math.max(1, Math.round(line.quantity) || 1));
    const lineNotes = sanitizeLineNotes(line.lineNotes);

    if (hasNativeCatalog && db) {
      const row = await getPublishedProduct(db, orgId, line.productId);
      if (!row) {
        return { ok: false, code: "product_unavailable", productId: line.productId };
      }
      if (row.stock_qty != null) {
        const reserved = await reservedQtyForProduct(
          db,
          orgId,
          line.productId,
          conversationId,
        );
        const available = Math.max(0, row.stock_qty - reserved);
        if (qty > available) {
          return { ok: false, code: "insufficient_stock", productId: line.productId };
        }
      }
      if (Number(row.allows_additions) === 1 && !lineNotes) {
        return { ok: false, code: "line_notes_required", productId: line.productId };
      }
      if (line.priceCents !== row.price_cents) priceChanged = true;
      lines.push({
        productId: row.id,
        name: chatCatalogTitle(row).slice(0, 200),
        priceCents: row.price_cents,
        currency: row.currency.slice(0, 8),
        quantity: qty,
        imageUrl: row.image_url?.trim() || line.imageUrl,
        lineNotes,
      });
    } else {
      lines.push({
        ...line,
        quantity: qty,
        lineNotes,
        name: String(line.name).slice(0, 200),
        priceCents: Math.max(0, Math.round(line.priceCents)),
      });
    }
  }

  const currency =
    lines[0]?.currency ?? cart.currency ?? "USD";

  return {
    ok: true,
    cart: {
      lines,
      currency,
      updatedAt: new Date().toISOString(),
    },
    priceChanged,
  };
}
