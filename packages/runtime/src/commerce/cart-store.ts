import type {
  CommerceBuyer,
  CommerceCart,
  CommerceCartLine,
  OrderFulfillment,
} from "@chatbot/domain";

export const META_CART = "commerce_cart_json";
export const META_BUYER = "commerce_buyer_json";
export const META_LAST_ORDER = "commerce_last_order_id";
/** Precios autorizados en el turno (respuesta de herramientas de catálogo). */
export const META_CATALOG_PRICES = "commerce_catalog_prices_json";
export const META_CHECKOUT_PENDING = "commerce_checkout_pending_json";
export const META_SOURCE_CHANNEL = "commerce_source_channel";
export const META_LINKED_STORE_CONVERSATION = "commerce_linked_store_conversation_id";
export const META_LINKED_STORE_CART = "linked_store_cart_json";
export const META_BUYER_CONSENT = "commerce_buyer_consent_at";
export const META_BUYER_CONSENT_POLICY = "commerce_buyer_consent_policy";
export const META_CHECKOUT_FULFILLMENT = "commerce_checkout_fulfillment_json";

export function emptyCart(currency = "USD"): CommerceCart {
  return { lines: [], currency, updatedAt: new Date().toISOString() };
}

export function parseCart(raw: string | null): CommerceCart {
  if (!raw) return emptyCart();
  try {
    const c = JSON.parse(raw) as CommerceCart;
    if (!Array.isArray(c.lines)) return emptyCart(c.currency ?? "USD");
    return {
      lines: c.lines.slice(0, 32),
      currency: c.currency ?? "USD",
      updatedAt: c.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyCart();
  }
}

export function parseBuyer(raw: string | null): CommerceBuyer | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CommerceBuyer;
  } catch {
    return null;
  }
}

export function parseCheckoutFulfillment(
  raw: string | null,
): OrderFulfillment | null {
  if (!raw?.trim()) return null;
  try {
    const f = JSON.parse(raw) as OrderFulfillment;
    if (f.mode !== "pickup" && f.mode !== "delivery") return null;
    return f;
  } catch {
    return null;
  }
}

export function cartSubtotalCents(cart: CommerceCart): number {
  return cart.lines.reduce((s, l) => s + l.priceCents * l.quantity, 0);
}

function cartLineKey(l: Pick<CommerceCartLine, "productId" | "lineNotes">): string {
  return `${l.productId}\0${(l.lineNotes ?? "").trim()}`;
}

export function addLine(cart: CommerceCart, line: CommerceCartLine): CommerceCart {
  const key = cartLineKey(line);
  const idx = cart.lines.findIndex((l) => cartLineKey(l) === key);
  const lines = [...cart.lines];
  if (idx >= 0) {
    lines[idx] = {
      ...lines[idx],
      quantity: lines[idx].quantity + line.quantity,
      priceCents: line.priceCents,
      name: line.name,
      lineNotes: line.lineNotes ?? lines[idx].lineNotes,
    };
  } else {
    lines.push(line);
  }
  return {
    ...cart,
    currency: line.currency || cart.currency,
    lines,
    updatedAt: new Date().toISOString(),
  };
}

export function updateLineQty(
  cart: CommerceCart,
  productId: string,
  quantity: number,
): CommerceCart {
  const lines = cart.lines
    .map((l) =>
      l.productId === productId ? { ...l, quantity: Math.max(0, quantity) } : l,
    )
    .filter((l) => l.quantity > 0);
  return { ...cart, lines, updatedAt: new Date().toISOString() };
}

export function formatCartForPrompt(cart: CommerceCart): string {
  if (!cart.lines.length) return "Carrito vacío.";
  const lines = cart.lines.map((l) => {
    const note = l.lineNotes?.trim() ? ` · ${l.lineNotes.trim()}` : "";
    return `- ${l.productId}: ${l.name}${note} x${l.quantity} = ${(l.priceCents * l.quantity) / 100} ${l.currency}`;
  });
  return `Carrito actual:\n${lines.join("\n")}\nSubtotal: ${cartSubtotalCents(cart) / 100} ${cart.currency}`;
}
