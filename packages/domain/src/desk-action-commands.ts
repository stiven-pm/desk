export const DESK_CMD_MENU = "__desk:menu__";
export const DESK_CMD_CART = "__desk:cart__";
export const DESK_CMD_PAY = "__desk:pay__";
export const DESK_CMD_CONSENT = "__desk:consent__";
export const DESK_CMD_CONFIRM_PRICE = "__desk:confirm_price__";
export const DESK_CMD_HUMAN = "__desk:human__";
export const DESK_CMD_OFFER_ACCEPT = "__desk:offer_accept__";
export const DESK_CMD_OFFER_DECLINE = "__desk:offer_decline__";
export const DESK_CMD_FULFILLMENT_PICKUP = "__desk:fulfillment:pickup__";
export const DESK_CMD_FULFILLMENT_DELIVERY = "__desk:fulfillment:delivery__";

export function deskCmdProduct(productId: string): string {
  return `__desk:product:${productId}__`;
}

export function deskCmdAdd(productId: string, quantity?: number): string {
  if (quantity == null) return `__desk:add:${productId}__`;
  const q = Math.min(99, Math.max(1, Math.round(quantity)));
  return `__desk:add:${productId}:${q}__`;
}

export function deskCmdSetQty(productId: string, quantity: number): string {
  const q = Math.min(99, Math.max(0, Math.round(quantity)));
  return `__desk:qty:${productId}:${q}__`;
}
