import type { NativeProductRow } from "./native-catalog";
import { chatCatalogTitle } from "./native-catalog";
import type { CommerceCart } from "@chatbot/domain";
import { NATIVE_COMMERCE_LEAD } from "@chatbot/domain";
import { existingCartLineQty } from "./visitor-quantity";

/** Bloqueo de stock solo al entrar a pago (no en carrito). */
export const STOCK_PAYMENT_HOLD_MINUTES = 5;
export const STOCK_RESERVE_TTL_MINUTES = STOCK_PAYMENT_HOLD_MINUTES;
export const STOCK_CHECKOUT_EXTEND_MINUTES = STOCK_PAYMENT_HOLD_MINUTES;

/** Unidades que este visitante puede añadir ahora (solo holds de pago ajenos). */
export function maxAddForProduct(args: {
  row: NativeProductRow;
  cart: CommerceCart;
  reservedOthers: number;
  lineNotes?: string;
}): number {
  const { row, cart, reservedOthers, lineNotes } = args;
  const existing = existingCartLineQty(cart, row.id, lineNotes);
  const policyCap = 99;
  if (row.stock_qty == null) {
    return Math.max(0, policyCap - existing);
  }
  const available = Math.max(0, row.stock_qty - reservedOthers - existing);
  return Math.min(policyCap, available);
}

/** Sin párrafos de stock en ficha de producto; solo mensaje corto si no puede añadir. */
export function stockAvailabilityHint(_args: {
  row: NativeProductRow;
  maxAdd: number;
  reservedOthers: number;
}): string | null {
  return null;
}

export function buildNoStockVisitorReply(args: {
  row: NativeProductRow;
  maxAdd: number;
  reservedOthers: number;
  cart?: CommerceCart;
  lineNotes?: string;
}): string {
  if (args.row.stock_qty != null && args.maxAdd < 1) {
    const existing = existingCartLineQty(
      args.cart ?? { lines: [], currency: "COP", updatedAt: "" },
      args.row.id,
      args.lineNotes,
    );
    const avail = Math.max(0, args.row.stock_qty - args.reservedOthers - existing);
    if (avail < 1) {
      return NATIVE_COMMERCE_LEAD.noUnitsAvailable;
    }
  }
  const title = chatCatalogTitle(args.row);
  return `No queda stock disponible para añadir más ${title}. Revisa tu carrito o el catálogo.`;
}

export function formatCatalogStockLabel(row: NativeProductRow): string | null {
  if (row.stock_qty == null) return null;
  return `${row.stock_qty} disp.`;
}
