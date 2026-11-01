import { describe, expect, it } from "vitest";
import {
  checkoutFlowToVisitorUi,
  EMPTY_CHECKOUT_FLOW,
  HUMAN_VERIFIED_TTL_MS,
  humanVerificationStillValid,
  isPayRetryBlocker,
  parseCheckoutFlow,
} from "./checkout-flow";

describe("parseCheckoutFlow", () => {
  it("vacío → idle", () => {
    expect(parseCheckoutFlow(null)).toEqual(EMPTY_CHECKOUT_FLOW);
  });

  it("blocked con turnstile", () => {
    const flow = parseCheckoutFlow(
      JSON.stringify({
        phase: "blocked",
        lastBlocker: "turnstile_required",
        attempts: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(flow.phase).toBe("blocked");
    expect(
      checkoutFlowToVisitorUi(flow, { verificationNeeded: false })
        .requiresTurnstile,
    ).toBe(true);
  });
});

describe("isPayRetryBlocker", () => {
  it("price_changed no es reintento", () => {
    expect(isPayRetryBlocker("price_changed")).toBe(false);
  });

  it("turnstile_required sí", () => {
    expect(isPayRetryBlocker("turnstile_required")).toBe(true);
  });
});

describe("humanVerificationStillValid", () => {
  it("dentro de TTL", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const at = "2026-01-01T11:45:00.000Z";
    expect(humanVerificationStillValid(at, now)).toBe(true);
  });

  it("fuera de TTL", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const at = new Date(now - HUMAN_VERIFIED_TTL_MS - 1).toISOString();
    expect(humanVerificationStillValid(at, now)).toBe(false);
  });
});
