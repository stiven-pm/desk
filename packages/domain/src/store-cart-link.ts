import { b64urlDecode, b64urlEncode as b64url } from "./b64url-bytes";

const STORE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoreCartLinkPayload = {
  v: 1 | 2;
  storeConversationId: string;
  chatConversationId: string;
  storeVisitorId: string;
  chatVisitorId?: string;
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

export async function signStoreCartLink(
  secret: string,
  args: {
    storeConversationId: string;
    chatConversationId: string;
    storeVisitorId: string;
    chatVisitorId: string;
  },
): Promise<string> {
  const payload: StoreCartLinkPayload = {
    v: 2,
    storeConversationId: args.storeConversationId,
    chatConversationId: args.chatConversationId,
    storeVisitorId: args.storeVisitorId,
    chatVisitorId: args.chatVisitorId,
    exp: Date.now() + STORE_LINK_TTL_MS,
  };
  const body = JSON.stringify(payload);
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `desk.storelink.v1.${b64url(new Uint8Array(sig))}.${b64url(new TextEncoder().encode(body))}`;
}

export async function verifyStoreCartLink(
  secret: string,
  token: string,
  expected: {
    storeConversationId: string;
    chatConversationId: string;
    storeVisitorId: string;
    chatVisitorId?: string;
  },
): Promise<{ ok: true } | { ok: false; code: string }> {
  const trimmed = token.trim();
  if (!trimmed.startsWith("desk.storelink.v1.")) {
    return { ok: false, code: "store_link_invalid" };
  }
  const rest = trimmed.slice("desk.storelink.v1.".length);
  const dot = rest.indexOf(".");
  if (dot < 1) return { ok: false, code: "store_link_invalid" };
  const sigB64 = rest.slice(0, dot);
  const bodyB64 = rest.slice(dot + 1);
  let payload: StoreCartLinkPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(bodyB64)),
    ) as StoreCartLinkPayload;
  } catch {
    return { ok: false, code: "store_link_invalid" };
  }
  if ((payload.v !== 1 && payload.v !== 2) || payload.exp < Date.now()) {
    return { ok: false, code: "store_link_expired" };
  }
  if (
    payload.storeConversationId !== expected.storeConversationId ||
    payload.chatConversationId !== expected.chatConversationId ||
    payload.storeVisitorId !== expected.storeVisitorId
  ) {
    return { ok: false, code: "store_link_mismatch" };
  }
  if (
    payload.v >= 2 &&
    payload.chatVisitorId &&
    expected.chatVisitorId &&
    payload.chatVisitorId !== expected.chatVisitorId
  ) {
    return { ok: false, code: "store_link_mismatch" };
  }
  const key = await hmacKey(secret);
  const body = new TextDecoder().decode(b64urlDecode(bodyB64));
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sigB64),
    new TextEncoder().encode(body),
  );
  return ok ? { ok: true } : { ok: false, code: "store_link_invalid" };
}
