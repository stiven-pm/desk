import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreemCheckout } from "../src/lib/creem";
import type { Env } from "../src/types";

afterEach(() => vi.unstubAllGlobals());

describe("Creem checkout (Flatbase contract)", () => {
  it("uses x-api-key and request_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "checkout_test",
        checkout_url: "https://checkout.test/checkout_test",
        product_id: "product_test",
        status: "pending",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCreemCheckout(
      {
        CREEM_API_KEY: "secret",
        CREEM_API_BASE_URL: "https://test-api.creem.io/v1",
      } as Env,
      {
        productId: "product_test",
        requestId: "DESK-ABC123",
        successUrl: "https://test-desk.rekov.co/billing/success",
        customerEmail: "test@example.com",
      },
    );

    expect(result.checkout_url).toContain("checkout_test");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test-api.creem.io/v1/checkouts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "secret" }),
      }),
    );
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      product_id: "product_test",
      request_id: "DESK-ABC123",
      customer: { email: "test@example.com" },
    });
  });
});
