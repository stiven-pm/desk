import { describe, expect, it } from "vitest";
import { buildCheckoutReturnSearchParams } from "./commerce-checkout-return-query";

describe("buildCheckoutReturnSearchParams", () => {
  it("includes checkout_status and public_ref after reconcile", () => {
    const params = buildCheckoutReturnSearchParams({
      orderAccessKey: "87b9f6d9-584f-4776-8af1-7e4ee4179e7d",
      status: "paid",
      publicRef: "RK-9206",
      summary: "Costillas x3",
      paymentId: "608d3bde-b1c9-4ab1-a031-f5689e9c0d2a",
      providerTransactionId: "12119682-1793415684-53149",
    });
    expect(params.get("checkout_return")).toBe("1");
    expect(params.get("order")).toBe("87b9f6d9-584f-4776-8af1-7e4ee4179e7d");
    expect(params.get("checkout_status")).toBe("paid");
    expect(params.get("public_ref")).toBe("RK-9206");
    expect(params.get("summary")).toBe("Costillas x3");
    expect(params.get("paymentId")).toBe("608d3bde-b1c9-4ab1-a031-f5689e9c0d2a");
    expect(params.get("id")).toBe("12119682-1793415684-53149");
  });
});
