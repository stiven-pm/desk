import { describe, expect, it } from "vitest";
import {
  hasPaymentWebhookSecret,
  parsePaymentWebhook,
  verifyPaymentWebhookAuth,
} from "./commerce-payment-webhook";

describe("commerce payment webhook (declarative only)", () => {
  it("detects webhook secret", () => {
    expect(hasPaymentWebhookSecret({})).toBe(false);
    expect(
      hasPaymentWebhookSecret({ genericWebhookSecret: "sec" }),
    ).toBe(true);
  });

  it("parses via plantilla profile", () => {
    const p = parsePaymentWebhook(
      "declarative",
      { payload: { ref: "RK-9", state: "APPROVED" } },
      {
        webhookAuth: { type: "bearer" },
        referenceJsonPath: "payload.ref",
        statusJsonPath: "payload.state",
        paidStatusValues: ["APPROVED"],
        syncGenericWebhookSecret: true,
      },
    );
    expect(p.status).toBe("paid");
    expect(p.orderReference).toBe("RK-9");
  });

  it("verifies bearer", async () => {
    const ok = await verifyPaymentWebhookAuth({
      provider: "declarative",
      secrets: { genericWebhookSecret: "tok" },
      bearerToken: "Bearer tok",
    });
    expect(ok).toEqual({ ok: true });
    const bad = await verifyPaymentWebhookAuth({
      provider: "declarative",
      secrets: { genericWebhookSecret: "tok" },
      bearerToken: "Bearer nope",
    });
    expect(bad).toEqual({ ok: false, code: "invalid_signature" });
  });
});
