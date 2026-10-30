import type { Env } from "../types";
import type { PlanSlug, WalletPackId } from "@chatbot/domain";
import { WALLET_CREDIT_PACKS } from "@chatbot/domain";

export function creemApiBase(env: Env): string {
  return env.CREEM_API_BASE_URL ?? "https://api.creem.io/v1";
}

export function resolveCreemProductId(env: Env, plan: PlanSlug): string | null {
  const map: Record<PlanSlug, string | undefined> = {
    starter: env.CREEM_PRODUCT_STARTER,
    growth: env.CREEM_PRODUCT_GROWTH,
    business: env.CREEM_PRODUCT_BUSINESS,
  };
  const id = map[plan]?.trim();
  if (!id || id.startsWith("prod_REPLACE")) return null;
  return id;
}

const WALLET_PRODUCT_BY_PACK: Record<WalletPackId, (env: Env) => string | undefined> = {
  "25": (e) => e.CREEM_PRODUCT_CREDITS_25,
  "50": (e) => e.CREEM_PRODUCT_CREDITS_50,
  "100": (e) => e.CREEM_PRODUCT_CREDITS_100,
};

export function resolveCreemWalletProductId(
  env: Env,
  pack: WalletPackId,
): string | null {
  const id = WALLET_PRODUCT_BY_PACK[pack](env)?.trim();
  if (!id || id.startsWith("prod_REPLACE")) return null;
  return id;
}

export function walletPackFromCreemProductId(
  env: Env,
  productId: string,
): WalletPackId | null {
  const pid = productId.trim();
  for (const pack of Object.keys(WALLET_CREDIT_PACKS) as WalletPackId[]) {
    if (resolveCreemWalletProductId(env, pack) === pid) return pack;
  }
  return null;
}

export function checkoutReturnBaseUrl(env: Env): string {
  const raw = (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith(".localhost") && u.hostname !== "localhost") {
      return `http://localhost:${u.port || "3000"}`;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

export function checkoutSuccessUrl(env: Env, pathWithQuery: string): string {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `${checkoutReturnBaseUrl(env)}${path}`;
}

export interface CreemCheckoutResponse {
  id: string;
  checkout_url: string;
  product_id?: string;
  status?: string;
  request_id?: string;
  order?: { id?: string; status?: string; amount?: number };
  subscription?: { id?: string };
  customer?: { id?: string; email?: string };
}

export async function getCreemCheckout(
  env: Env,
  checkoutId: string,
): Promise<CreemCheckoutResponse | null> {
  if (!env.CREEM_API_KEY) return null;
  const url = new URL(`${creemApiBase(env)}/checkouts`);
  url.searchParams.set("checkout_id", checkoutId);
  const res = await fetch(url, {
    headers: { "x-api-key": env.CREEM_API_KEY },
  });
  if (!res.ok) {
    console.error("creem_get_checkout_failed", res.status, await res.text());
    return null;
  }
  return (await res.json()) as CreemCheckoutResponse;
}

export function isCreemCheckoutPaid(checkout: CreemCheckoutResponse): boolean {
  const status = (checkout.status || "").toLowerCase();
  if (status === "completed" || status === "paid") return true;
  const orderStatus = (checkout.order?.status || "").toLowerCase();
  return orderStatus === "paid" || orderStatus === "completed";
}

export async function createCreemCheckout(
  env: Env,
  input: {
    productId: string;
    requestId: string;
    successUrl: string;
    customerEmail?: string;
    customerId?: string | null;
  },
): Promise<CreemCheckoutResponse> {
  if (!env.CREEM_API_KEY) throw new Error("billing_not_configured");

  const customer = input.customerId?.trim()
    ? { id: input.customerId.trim() }
    : input.customerEmail
      ? { email: input.customerEmail.trim().toLowerCase() }
      : undefined;

  const res = await fetch(`${creemApiBase(env)}/checkouts`, {
    method: "POST",
    headers: {
      "x-api-key": env.CREEM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: input.productId,
      request_id: input.requestId,
      success_url: input.successUrl,
      ...(customer ? { customer } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("creem_checkout_failed", res.status, text);
    throw new Error("checkout_unavailable");
  }

  const data = (await res.json()) as Partial<CreemCheckoutResponse>;
  if (!data.id || !data.checkout_url) {
    console.error("creem_checkout_invalid_response", data);
    throw new Error("checkout_unavailable");
  }
  return data as CreemCheckoutResponse;
}

export async function verifyCreemWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computed = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const normalized = signature.replace(/^sha256=/i, "");
  return computed === normalized || signature === `sha256=${computed}`;
}
