import { DESK_UI_FENCE } from "@chatbot/chat-ui";
import type { CommerceCart } from "@chatbot/domain";
import {
  COMMERCE_VISITOR_LABEL,
  DESK_CMD_CART,
  DESK_CMD_CONFIRM_PRICE,
  DESK_CMD_CONSENT,
  DESK_CMD_MENU,
  DESK_CMD_PAY,
  deskCmdAdd,
  NATIVE_COMMERCE_LEAD,
  nativeInvalidQuantityPrompt,
  nativeQuantityAskPrompt,
} from "@chatbot/domain";
import type { NativeProductRow } from "./native-catalog";
import { chatCatalogTitle, chatCatalogDescription } from "./native-catalog";
import {
  maxAddQuantityForRow,
  quantityRangeLabel,
} from "./visitor-quantity";

export {
  DESK_CMD_CART,
  DESK_CMD_CONFIRM_PRICE,
  DESK_CMD_CONSENT,
  DESK_CMD_MENU,
  DESK_CMD_PAY,
  deskCmdAdd,
};

export function formatMoneyCents(cents: number, currency: string): string {
  const major = cents / 100;
  const formatted = Number.isInteger(major)
    ? major.toLocaleString("es-CO")
    : major.toLocaleString("es-CO", { minimumFractionDigits: 2 });
  return `${formatted} ${currency}`;
}

export function buildCartDeskUiBlock(cart: CommerceCart): Record<string, unknown> | null {
  if (!cart.lines.length) return null;
  return {
    type: "cart",
    currency: cart.currency,
    lines: cart.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      priceCents: l.priceCents,
      quantity: l.quantity,
      imageUrl: l.imageUrl,
    })),
  };
}

export function appendCartDeskUiFence(text: string, cart: CommerceCart): string {
  const block = buildCartDeskUiBlock(cart);
  if (!block) return text;
  if (text.includes('"type":"cart"') || text.includes('"type": "cart"')) {
    return text;
  }
  const fence = `\n\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({ blocks: [block] })}\n\`\`\``;
  return text.trimEnd() + fence;
}

function deskUiFence(blocks: Record<string, unknown>[]): string {
  return `\n\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({ blocks })}\n\`\`\``;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Imagen + descripción; acciones solo en bloque choices. */
export function buildProductDetailDeskUi(
  row: NativeProductRow,
  cart?: CommerceCart | null,
  stockNote?: string | null,
): string {
  const price = formatMoneyCents(row.price_cents, row.currency);
  const compare =
    row.compare_at_price_cents != null
      ? formatMoneyCents(row.compare_at_price_cents, row.currency)
      : undefined;
  const parts: string[] = [];
  const imageUrl = row.image_url?.trim();
  if (imageUrl) {
    parts.push(`<img src="${escapeHtml(imageUrl)}" alt="" />`);
  }
  parts.push(`<p><strong>${escapeHtml(chatCatalogTitle(row))}</strong></p>`);
  const description = chatCatalogDescription(row);
  if (description) {
    parts.push(`<p>${escapeHtml(description)}</p>`);
  }
  if (compare) {
    parts.push(
      `<p><span>${escapeHtml(compare)}</span> → <strong>${escapeHtml(price)}</strong></p>`,
    );
  } else {
    parts.push(`<p><strong>${escapeHtml(price)}</strong></p>`);
  }
  if (row.promo_label?.trim()) {
    parts.push(`<p>${escapeHtml(row.promo_label.trim())}</p>`);
  }
  const choiceItems: Array<{ label: string; message: string }> = [
    { label: COMMERCE_VISITOR_LABEL.addToCart, message: deskCmdAdd(row.id) },
  ];
  if (cart?.lines.length) {
    choiceItems.push({
      label: COMMERCE_VISITOR_LABEL.cart,
      message: DESK_CMD_CART,
    });
  }
  choiceItems.push({
    label: COMMERCE_VISITOR_LABEL.viewProductsFromDetail,
    message: DESK_CMD_MENU,
  });
  const choices = {
    type: "choices",
    items: choiceItems,
  };
  return deskUiFence([{ type: "html", html: parts.join("") }, choices]);
}

/** Tras elegir producto: el visitante responde con un número en el chat. */
export function buildQuantityPickerDeskUi(
  row: NativeProductRow,
  maxAdd: number,
): string {
  const range = quantityRangeLabel(Math.max(1, maxAdd));
  return nativeQuantityAskPrompt(row.name, range);
}

export function buildInvalidQuantityReply(
  row: NativeProductRow,
  maxAdd: number,
): string {
  const range = quantityRangeLabel(Math.max(1, maxAdd));
  return nativeInvalidQuantityPrompt(range);
}

export function buildNoStockToAddReply(row: NativeProductRow): string {
  return `No queda stock disponible para añadir más ${chatCatalogTitle(row)}. Revisa tu carrito o el menú.`;
}

export type PostCartChoicesKind = "default" | "cart_view" | "empty";

function postCartChoiceItems(
  cart: CommerceCart,
  kind: PostCartChoicesKind,
): Array<{ label: string; message: string }> {
  if (kind === "empty" || !cart.lines.length) {
    return [{ label: COMMERCE_VISITOR_LABEL.menu, message: DESK_CMD_MENU }];
  }
  const items: Array<{ label: string; message: string }> = [
    { label: COMMERCE_VISITOR_LABEL.pay, message: DESK_CMD_PAY },
  ];
  if (kind !== "cart_view") {
    items.push({ label: COMMERCE_VISITOR_LABEL.cart, message: DESK_CMD_CART });
  }
  items.push({ label: COMMERCE_VISITOR_LABEL.menu, message: DESK_CMD_MENU });
  return items;
}

export function appendPostCartChoicesDeskUi(
  text: string,
  cart: CommerceCart,
  kind: PostCartChoicesKind = "default",
): string {
  const items = postCartChoiceItems(cart, kind);
  if (text.includes('"type":"choices"') || text.includes('"type": "choices"')) {
    return text;
  }
  return text.trimEnd() + deskUiFence([{ type: "choices", items }]);
}

export function buildBuyerConsentDeskUi(): string {
  const choices = {
    type: "choices",
    items: [{ label: COMMERCE_VISITOR_LABEL.consent, message: DESK_CMD_CONSENT }],
  };
  return `${NATIVE_COMMERCE_LEAD.consentBeforePay}${deskUiFence([choices])}`;
}
