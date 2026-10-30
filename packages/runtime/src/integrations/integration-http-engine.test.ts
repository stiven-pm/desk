import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildTemplateVars,
  executeIntegrationOperation,
} from "./integration-http-engine";

describe("buildTemplateVars", () => {
  it("aliases amount fields", () => {
    const v = buildTemplateVars({}, { amountInCents: "5000", reference: "RK-1" });
    expect(v.amount).toBe("5000");
    expect(v.amount_cents).toBe("5000");
  });
});

describe("executeIntegrationOperation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps checkout response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ data: { url: "https://checkout.test/pay", id: "ext1" } }),
      }),
    );

    const result = await executeIntegrationOperation(
      {
        baseUrl: "https://api.checkout.test",
        authType: "bearer",
        authFieldKey: "apiKey",
      },
      {
        capability: "payment.create_link",
        slug: "create_link",
        method: "POST",
        pathTemplate: "/links",
        bodyTemplate: '{"ref":"{{reference}}"}',
        queryTemplate: {},
        responseMap: {
          fields: {
            checkoutUrl: "data.url",
            externalId: "data.id",
          },
        },
      },
      { apiKey: "secret-key-12345678" },
      { reference: "RK-1" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mapped.checkoutUrl).toBe("https://checkout.test/pay");
      expect(result.mapped.externalId).toBe("ext1");
    }
  });
});
