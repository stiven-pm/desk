import { describe, expect, it } from "vitest";
import {
  buyerMatchesDocument,
  buyerMatchesName,
  findOrderInRecentByBuyer,
  mergeNativeOrderLookup,
} from "./native-order-lookup";

describe("mergeNativeOrderLookup (tool args from model)", () => {
  it("mapea orderId RK a publicRef", () => {
    expect(mergeNativeOrderLookup("RK-99").publicRef).toBe("RK-99");
  });

  it("combina campos explícitos del tool call", () => {
    const q = mergeNativeOrderLookup(undefined, {
      customerName: "Stiven Ruiz",
      orderHint: "31 de octubre 4 costillas",
    });
    expect(q.customerName).toBe("Stiven Ruiz");
    expect(q.orderHint).toMatch(/costill/i);
  });
});

describe("findOrderInRecentByBuyer", () => {
  const rows = [
    {
      id: "1",
      public_ref: "RK-1",
      buyer_json: JSON.stringify({
        name: "Ana Pérez",
        documentId: "1234567890",
      }),
    },
  ];

  it("encuentra por documento", () => {
    const hit = findOrderInRecentByBuyer(rows, { documentId: "1234567890" });
    expect(hit?.public_ref).toBe("RK-1");
  });

  it("encuentra por nombre parcial", () => {
    expect(buyerMatchesName({ name: "Ana Pérez" }, "ana")).toBe(true);
    const hit = findOrderInRecentByBuyer(rows, { customerName: "Ana" });
    expect(hit?.public_ref).toBe("RK-1");
  });

  it("encuentra por orderHint + nombre del tool", () => {
    const rowsStiven = [
      {
        id: "3",
        public_ref: "RK-9051",
        summary: "Costillas x4",
        buyer_json: JSON.stringify({ name: "Stiven Ruiz" }),
        created_at: "2026-10-31T08:50:41.000Z",
      },
    ];
    const hit = findOrderInRecentByBuyer(rowsStiven, {
      customerName: "Stiven Ruiz",
      orderHint: "31 de octubre 4 coatillas",
    });
    expect(hit?.public_ref).toBe("RK-9051");
  });
});
