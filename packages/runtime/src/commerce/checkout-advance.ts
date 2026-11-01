import {
  type CheckoutBlocker,
  type CheckoutFlow,
  missingCommerceBuyerFields,
} from "@chatbot/domain";
import type { CommerceService } from "./commerce-service";
import { formatMoneyCents } from "./commerce-ui";

export type AdvanceResult =
  | { step: "ask_fields"; fields: string[] }
  | { step: "ask_consent" }
  | { step: "ask_fulfillment"; options: ("pickup" | "delivery")[] }
  | { step: "confirm_price"; totalFormatted?: string }
  | { step: "link_ready"; checkoutUrl: string }
  | { step: "blocked"; blocker: CheckoutBlocker; retryable: boolean };

const KNOWN_BLOCKERS: ReadonlySet<string> = new Set<CheckoutBlocker>([
  "turnstile_required",
  "turnstile_failed",
  "turnstile_not_configured",
  "checkout_in_progress",
  "out_of_stock",
  "provider_error",
]);

export async function advanceCheckout(
  svc: CommerceService,
  opts?: {
    turnstileToken?: string;
    confirmPriceChange?: boolean;
    confirmCartChange?: boolean;
  },
): Promise<AdvanceResult> {
  const manifest = await svc.loadManifest();
  const missing = missingCommerceBuyerFields(svc.getBuyer(), manifest);
  if (missing.length) return { step: "ask_fields", fields: missing };
  if (!svc.hasBuyerConsent()) return { step: "ask_consent" };
  if (!svc.getCheckoutFulfillment()) {
    return { step: "ask_fulfillment", options: ["pickup", "delivery"] };
  }

  const r = await svc.startCheckout(opts);
  if (r.ok) return { step: "link_ready", checkoutUrl: r.checkoutUrl };

  if (r.code === "fulfillment_required") {
    return { step: "ask_fulfillment", options: ["pickup", "delivery"] };
  }
  if (r.code === "price_changed" || r.code === "cart_changed") {
    return {
      step: "confirm_price",
      totalFormatted:
        r.subtotalCents != null && r.currency
          ? formatMoneyCents(r.subtotalCents, r.currency)
          : undefined,
    };
  }

  const blocker: CheckoutBlocker = KNOWN_BLOCKERS.has(r.code)
    ? (r.code as CheckoutBlocker)
    : "provider_error";
  const retryable = ![
    "out_of_stock",
    "turnstile_not_configured",
    "checkout_in_progress",
  ].includes(blocker);
  return { step: "blocked", blocker, retryable };
}

export function flowFromAdvance(
  prev: CheckoutFlow,
  r: AdvanceResult,
): CheckoutFlow {
  const updatedAt = new Date().toISOString();
  const failed =
    r.step === "blocked"
      ? prev.attempts + 1
      : r.step === "link_ready"
        ? 0
        : prev.attempts;

  switch (r.step) {
    case "ask_fields":
      return {
        phase: "collecting_buyer",
        missingFields: r.fields,
        attempts: failed,
        updatedAt,
      };
    case "ask_consent":
      return { phase: "consent", attempts: failed, updatedAt };
    case "ask_fulfillment":
      return { phase: "fulfillment", attempts: failed, updatedAt };
    case "confirm_price":
      return {
        phase: "blocked",
        lastBlocker: "price_changed",
        attempts: failed,
        updatedAt,
      };
    case "link_ready":
      return { phase: "payment_link_sent", attempts: 0, updatedAt };
    case "blocked":
      return {
        phase: "blocked",
        lastBlocker: r.blocker,
        attempts: failed,
        updatedAt,
      };
  }
}
