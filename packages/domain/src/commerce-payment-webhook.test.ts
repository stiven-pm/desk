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

  it("verifies Wompi X-Event-Checksum", async () => {
    const secret = "prod_events_testsecret";
    const body = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: "tx-1",
          status: "APPROVED",
          reference: "RK-9",
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.reference"],
        timestamp: 1700000000,
      },
    };
    let concat = "tx-1APPROVEDRK-9" + String(1700000000) + secret;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(concat),
    );
    const checksum = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    (body.signature as { checksum?: string }).checksum = checksum;

    const ok = await verifyPaymentWebhookAuth({
      provider: "declarative",
      secrets: { genericWebhookSecret: secret },
      body,
      eventChecksumHeader: checksum,
    });
    expect(ok).toEqual({ ok: true });
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
