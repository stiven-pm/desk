export const CHECKOUT_FLOW_META_KEY = "checkout_flow_json";
export const HUMAN_VERIFIED_META_KEY = "human_verified_at";
export const HUMAN_VERIFIED_TTL_MS = 30 * 60_000;

export type CheckoutPhase =
  | "idle"
  | "collecting_buyer"
  | "consent"
  | "fulfillment"
  | "payment_link_sent"
  | "blocked";

export type CheckoutBlocker =
  | "turnstile_required"
  | "turnstile_failed"
  | "turnstile_not_configured"
  | "price_changed"
  | "cart_changed"
  | "checkout_in_progress"
  | "out_of_stock"
  | "provider_error";

export interface CheckoutFlow {
  phase: CheckoutPhase;
  missingFields?: string[];
  lastBlocker?: CheckoutBlocker;
  attempts: number;
  updatedAt: string;
}

export const EMPTY_CHECKOUT_FLOW: CheckoutFlow = {
  phase: "idle",
  attempts: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

const PAY_RETRY: ReadonlySet<CheckoutBlocker> = new Set([
  "turnstile_required",
  "turnstile_failed",
  "provider_error",
]);

export function isPayRetryBlocker(b?: CheckoutBlocker): boolean {
  return !!b && PAY_RETRY.has(b);
}

/** Turnstile ya superado en esta conversación (ventana fija, multi-tenant). */
export function humanVerificationStillValid(
  verifiedAtIso: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!verifiedAtIso?.trim()) return false;
  const ts = Date.parse(verifiedAtIso);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts < HUMAN_VERIFIED_TTL_MS;
}

export function parseCheckoutFlow(raw: string | null | undefined): CheckoutFlow {
  if (!raw?.trim()) return EMPTY_CHECKOUT_FLOW;
  try {
    const o = JSON.parse(raw) as CheckoutFlow;
    return o?.phase ? o : EMPTY_CHECKOUT_FLOW;
  } catch {
    return EMPTY_CHECKOUT_FLOW;
  }
}

export type CheckoutVisitorUi = {
  requiresTurnstile: boolean;
  phase: CheckoutPhase;
  blocker?: CheckoutBlocker;
};

/** Alias usado en runtime/API. */
export type VisitorCheckoutUi = CheckoutVisitorUi;

export function checkoutFlowToVisitorUi(
  f: CheckoutFlow,
  extra: { verificationNeeded: boolean },
): CheckoutVisitorUi {
  return {
    requiresTurnstile:
      extra.verificationNeeded ||
      (f.phase === "blocked" &&
        (f.lastBlocker === "turnstile_required" ||
          f.lastBlocker === "turnstile_failed")),
    phase: f.phase,
    blocker: f.lastBlocker,
  };
}

export function checkoutFlowPromptSection(
  f: CheckoutFlow,
  cartSummary: string,
): string {
  return [
    "## Estado de la compra (solo para ti; no lo cites tal cual)",
    `fase: ${f.phase}${f.lastBlocker ? ` · bloqueo: ${f.lastBlocker}` : ""} · intentos fallidos: ${f.attempts}`,
    f.missingFields?.length
      ? `datos que faltan: ${f.missingFields.join(", ")}`
      : "",
    `carrito: ${cartSummary || "vacío"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
