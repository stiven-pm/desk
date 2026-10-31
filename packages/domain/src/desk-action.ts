import { DESK_CMD_CART, DESK_CMD_CONFIRM_PRICE, DESK_CMD_CONSENT, DESK_CMD_FULFILLMENT_DELIVERY, DESK_CMD_FULFILLMENT_PICKUP, DESK_CMD_HUMAN, DESK_CMD_MENU, DESK_CMD_OFFER_ACCEPT, DESK_CMD_OFFER_DECLINE, DESK_CMD_PAY, deskCmdAdd, deskCmdProduct, deskCmdSetQty } from "./desk-action-commands";
import { b64urlDecode, b64urlEncode as b64url } from "./b64url-bytes";

export const DESK_ACTION_PREFIX = "desk.act.v1.";

export type DeskCommand =
  | { kind: "menu" }
  | { kind: "cart" }
  | { kind: "pay" }
  | { kind: "consent" }
  | { kind: "confirm_price" }
  | { kind: "human" }
  | { kind: "offer_accept" }
  | { kind: "offer_decline" }
  | { kind: "fulfillment_pickup" }
  | { kind: "fulfillment_delivery" }
  | { kind: "add"; productId: string; quantity?: number }
  | { kind: "view_product"; productId: string; title?: string }
  | { kind: "set_qty"; productId: string; quantity: number };

type DeskActionPayload = {
  v: 1;
  cid: string;
  cmd: DeskCommand;
  exp: number;
};

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function deskCommandToInternal(cmd: DeskCommand): string {
  switch (cmd.kind) {
    case "menu":
      return DESK_CMD_MENU;
    case "cart":
      return DESK_CMD_CART;
    case "pay":
      return DESK_CMD_PAY;
    case "consent":
      return DESK_CMD_CONSENT;
    case "confirm_price":
      return DESK_CMD_CONFIRM_PRICE;
    case "human":
      return DESK_CMD_HUMAN;
    case "offer_accept":
      return DESK_CMD_OFFER_ACCEPT;
    case "offer_decline":
      return DESK_CMD_OFFER_DECLINE;
    case "fulfillment_pickup":
      return DESK_CMD_FULFILLMENT_PICKUP;
    case "fulfillment_delivery":
      return DESK_CMD_FULFILLMENT_DELIVERY;
    case "add":
      return deskCmdAdd(cmd.productId, cmd.quantity);
    case "view_product":
      return deskCmdProduct(cmd.productId);
    case "set_qty":
      return deskCmdSetQty(cmd.productId, cmd.quantity);
  }
}

export function deskCommandDisplayLabel(cmd: DeskCommand): string {
  switch (cmd.kind) {
    case "menu":
      return "Menú";
    case "cart":
      return "Ver carrito";
    case "pay":
      return "Pagar";
    case "consent":
      return "Acepto";
    case "confirm_price":
      return "Confirmar total";
    case "human":
      return "Hablar con una persona";
    case "offer_accept":
      return "Sí";
    case "offer_decline":
      return "No";
    case "fulfillment_pickup":
      return "Recoger en tienda";
    case "fulfillment_delivery":
      return "Envío a domicilio";
    case "add":
      return cmd.quantity != null && cmd.quantity > 1
        ? `Añadir ${cmd.quantity}`
        : "Añadir al carrito";
    case "view_product":
      return cmd.title?.trim() ? cmd.title.trim() : "Ver producto";
    case "set_qty":
      return cmd.quantity === 0 ? "Quitar del carrito" : `Cantidad ${cmd.quantity}`;
  }
}

export function isDeskActionToken(text: string): boolean {
  return text.trim().startsWith(DESK_ACTION_PREFIX);
}

export function isRawDeskCommand(text: string): boolean {
  const t = text.trim();
  return parseInternalDeskCommand(t) != null;
}

export function parseInternalDeskCommand(text: string): DeskCommand | null {
  const t = text.trim();
  if (t === DESK_CMD_MENU) return { kind: "menu" };
  if (t === DESK_CMD_CART) return { kind: "cart" };
  if (t === DESK_CMD_PAY) return { kind: "pay" };
  if (t === DESK_CMD_CONSENT) return { kind: "consent" };
  if (t === DESK_CMD_CONFIRM_PRICE) return { kind: "confirm_price" };
  if (t === DESK_CMD_HUMAN) return { kind: "human" };
  if (t === DESK_CMD_OFFER_ACCEPT) return { kind: "offer_accept" };
  if (t === DESK_CMD_OFFER_DECLINE) return { kind: "offer_decline" };
  if (t === DESK_CMD_FULFILLMENT_PICKUP) return { kind: "fulfillment_pickup" };
  if (t === DESK_CMD_FULFILLMENT_DELIVERY) return { kind: "fulfillment_delivery" };
  const product = t.match(/^__desk:product:([^:]+)__$/);
  if (product?.[1]) {
    return { kind: "view_product", productId: product[1] };
  }
  const add = t.match(/^__desk:add:([^:]+)(?::(\d+))?__$/);
  if (add?.[1]) {
    const quantity = add[2] ? Number(add[2]) : undefined;
    return {
      kind: "add",
      productId: add[1],
      quantity:
        quantity != null && Number.isFinite(quantity) ? quantity : undefined,
    };
  }
  const qty = t.match(/^__desk:qty:([^:]+):(\d+)__$/);
  if (qty?.[1] != null && qty[2] != null) {
    return {
      kind: "set_qty",
      productId: qty[1],
      quantity: Number(qty[2]),
    };
  }
  return null;
}

export async function signDeskAction(
  secret: string,
  conversationId: string,
  cmd: DeskCommand,
  ttlSec = 3600,
): Promise<string> {
  if (!secret.trim()) return deskCommandToInternal(cmd);
  const payload: DeskActionPayload = {
    v: 1,
    cid: conversationId,
    cmd,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const body = b64url(new Uint8Array(new TextEncoder().encode(JSON.stringify(payload))));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `${DESK_ACTION_PREFIX}${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyDeskAction(
  secret: string,
  conversationId: string,
  token: string,
): Promise<{ cmd: DeskCommand; displayLabel: string; commandText: string } | null> {
  if (!secret.trim()) return null;
  const trimmed = token.trim();
  if (!trimmed.startsWith(DESK_ACTION_PREFIX)) return null;
  const rest = trimmed.slice(DESK_ACTION_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = rest.slice(0, dot);
  const sigB64 = rest.slice(dot + 1);
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigB64),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as DeskActionPayload;
    if (payload.v !== 1 || payload.cid !== conversationId) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    const cmd = payload.cmd;
    return {
      cmd,
      displayLabel: deskCommandDisplayLabel(cmd),
      commandText: deskCommandToInternal(cmd),
    };
  } catch {
    return null;
  }
}

export async function internalDeskCommandToToken(
  secret: string,
  conversationId: string,
  commandText: string,
): Promise<string | null> {
  const t = commandText.trim();
  if (t === DESK_CMD_MENU) return signDeskAction(secret, conversationId, { kind: "menu" });
  if (t === DESK_CMD_CART) return signDeskAction(secret, conversationId, { kind: "cart" });
  if (t === DESK_CMD_PAY) return signDeskAction(secret, conversationId, { kind: "pay" });
  if (t === DESK_CMD_CONSENT) return signDeskAction(secret, conversationId, { kind: "consent" });
  if (t === DESK_CMD_CONFIRM_PRICE) {
    return signDeskAction(secret, conversationId, { kind: "confirm_price" });
  }
  if (t === DESK_CMD_HUMAN) {
    return signDeskAction(secret, conversationId, { kind: "human" });
  }
  if (t === DESK_CMD_OFFER_ACCEPT) {
    return signDeskAction(secret, conversationId, { kind: "offer_accept" });
  }
  if (t === DESK_CMD_OFFER_DECLINE) {
    return signDeskAction(secret, conversationId, { kind: "offer_decline" });
  }
  if (t === DESK_CMD_FULFILLMENT_PICKUP) {
    return signDeskAction(secret, conversationId, { kind: "fulfillment_pickup" });
  }
  if (t === DESK_CMD_FULFILLMENT_DELIVERY) {
    return signDeskAction(secret, conversationId, { kind: "fulfillment_delivery" });
  }
  const product = t.match(/^__desk:product:([^:]+)__$/);
  if (product?.[1]) {
    return signDeskAction(secret, conversationId, {
      kind: "view_product",
      productId: product[1],
    });
  }
  const add = t.match(/^__desk:add:([^:]+)(?::(\d+))?__$/);
  if (add?.[1]) {
    const quantity = add[2] ? Number(add[2]) : undefined;
    return signDeskAction(secret, conversationId, {
      kind: "add",
      productId: add[1],
      quantity:
        quantity != null && Number.isFinite(quantity) ? quantity : undefined,
    });
  }
  const qty = t.match(/^__desk:qty:([^:]+):(\d+)__$/);
  if (qty?.[1] != null && qty[2] != null) {
    return signDeskAction(secret, conversationId, {
      kind: "set_qty",
      productId: qty[1],
      quantity: Number(qty[2]),
    });
  }
  return null;
}
