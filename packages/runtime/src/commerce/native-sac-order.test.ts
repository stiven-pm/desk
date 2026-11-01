import { describe, expect, it } from "vitest";
import { formatNativeOrderSacReplyForVisitor } from "./native-sac-order";

describe("native-sac-order", () => {
  it("formatea respuesta con estado del pedido", () => {
    const t = formatNativeOrderSacReplyForVisitor({
      public_ref: "RK-123",
      status: "paid",
      summary: "4 costillas",
      created_at: "2026-10-30T12:00:00.000Z",
    });
    expect(t).toContain("RK-123");
    expect(t).toContain("pagado");
  });
});
