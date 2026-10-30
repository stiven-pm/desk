import type { CommerceBuyer, CommerceCart } from "@chatbot/domain";
import {
  META_BUYER,
  META_BUYER_CONSENT,
  META_BUYER_CONSENT_POLICY,
  META_LINKED_STORE_CART,
  parseBuyer,
  parseCart,
} from "./cart-store";

export type LinkedStoreCommerceProxy = {
  storeConversationId: string;
  fetchStore: (path: string, init?: RequestInit) => Promise<Response>;
};

export type MetaWriter = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export function mirrorLinkedStoreStateToMeta(
  meta: MetaWriter,
  payload: {
    cart?: CommerceCart | null;
    buyer?: CommerceBuyer | null;
    buyerConsentAt?: string | null;
  },
): void {
  if (payload.cart && Array.isArray(payload.cart.lines)) {
    meta.set(META_LINKED_STORE_CART, JSON.stringify(payload.cart));
  }
  if (payload.buyer) {
    meta.set(META_BUYER, JSON.stringify(payload.buyer));
  } else if (payload.buyer === null) {
    meta.set(META_BUYER, "");
  }
  if (payload.buyerConsentAt?.trim()) {
    meta.set(META_BUYER_CONSENT, payload.buyerConsentAt.trim());
    meta.set(META_BUYER_CONSENT_POLICY, "desk-ley1581-v1");
  }
}

export async function pullLinkedStoreState(
  proxy: LinkedStoreCommerceProxy,
): Promise<{
  cart: CommerceCart;
  buyer: CommerceBuyer | null;
  buyerConsentAt: string | null;
} | null> {
  const res = await proxy.fetchStore("/commerce/cart", { method: "GET" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    cart?: CommerceCart;
    buyer?: CommerceBuyer | null;
    buyerConsentAt?: string | null;
  };
  return {
    cart: parseCart(data.cart ? JSON.stringify(data.cart) : null),
    buyer: data.buyer ? parseBuyer(JSON.stringify(data.buyer)) : null,
    buyerConsentAt: data.buyerConsentAt?.trim() || null,
  };
}

export async function refreshLinkedStoreMirror(
  proxy: LinkedStoreCommerceProxy,
  meta: MetaWriter,
): Promise<CommerceCart | null> {
  const pulled = await pullLinkedStoreState(proxy);
  if (!pulled) return null;
  mirrorLinkedStoreStateToMeta(meta, pulled);
  return pulled.cart;
}
