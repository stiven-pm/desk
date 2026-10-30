import { NATIVE_COMMERCE_LEAD } from "@chatbot/domain";
import type { NativeProductRow } from "./native-catalog";

export const VISITOR_QTY_MAX = 99;

export function maxQuantityForRow(row: NativeProductRow): number {
  if (row.stock_qty != null && row.stock_qty > 0) {
    return Math.min(VISITOR_QTY_MAX, row.stock_qty);
  }
  return VISITOR_QTY_MAX;
}

export function quantityRangeLabel(max: number): string {
  if (max <= 1) return "1";
  if (max < VISITOR_QTY_MAX) return `1 y ${max}`;
  return `1 y ${VISITOR_QTY_MAX}`;
}

/** Unidades ya en carrito que se fusionarían con la misma clave producto+nota. */
export function existingCartLineQty(
  cart: CommerceCart,
  productId: string,
  lineNotes?: string,
): number {
  const noteKey = (lineNotes ?? "").trim();
  const line = cart.lines.find(
    (l) =>
      l.productId === productId && (l.lineNotes ?? "").trim() === noteKey,
  );
  return line?.quantity ?? 0;
}

/** Cuántas unidades puede añadir ahora (stock, reservas ajenas y lo ya en carrito). */
export function maxAddQuantityForRow(
  row: NativeProductRow,
  cart: CommerceCart,
  reservedOthers: number,
  lineNotes?: string,
  _opts?: { honorRemoteReservations?: boolean },
): number {
  const policyCap = VISITOR_QTY_MAX;
  const existing = existingCartLineQty(cart, row.id, lineNotes);
  if (row.stock_qty == null) {
    return Math.max(0, policyCap - existing);
  }
  const availableStock = Math.max(
    0,
    row.stock_qty - reservedOthers - existing,
  );
  return Math.min(policyCap, availableStock);
}

/** Cantidad enviada por el visitante en un mensaje de chat (solo dígitos, 1–99). */
export function parseVisitorQuantityMessage(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})(?:\s*(?:u(?:nidad(?:es)?)?|x))?\s*\.?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(VISITOR_QTY_MAX, Math.round(n));
}

export function validateAddQuantityForRow(
  row: NativeProductRow,
  quantity: number,
  cart: CommerceCart,
  reservedOthers: number,
  lineNotes?: string,
): { ok: true; quantity: number } | { ok: false; message: string } {
  const q = Math.min(VISITOR_QTY_MAX, Math.max(1, Math.round(quantity)));
  const maxAdd = maxAddQuantityForRow(row, cart, reservedOthers, lineNotes);
  if (maxAdd < 1) {
    if (row.stock_qty != null) {
      const avail = Math.max(
        0,
        row.stock_qty - reservedOthers - existingCartLineQty(cart, row.id, lineNotes),
      );
      if (avail < 1) {
        return { ok: false, message: NATIVE_COMMERCE_LEAD.noUnitsAvailable };
      }
    }
    return {
      ok: false,
      message: "Ya tienes el máximo disponible de este producto en el carrito.",
    };
  }
  if (q > maxAdd) {
    return {
      ok: false,
      message:
        maxAdd === 1
          ? "Solo puedes añadir 1 unidad más."
          : `Solo puedes añadir hasta ${maxAdd} unidades más (stock y carrito).`,
    };
  }
  return { ok: true, quantity: q };
}

/** @deprecated use validateAddQuantityForRow */
export function validateVisitorQuantityForRow(
  row: NativeProductRow,
  quantity: number,
): { ok: true; quantity: number } | { ok: false; message: string } {
  return validateAddQuantityForRow(row, quantity, { lines: [], currency: "USD" }, 0);
}
