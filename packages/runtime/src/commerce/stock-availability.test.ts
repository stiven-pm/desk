import { describe, expect, it } from "vitest";
import {
  buildNoStockVisitorReply,
  maxAddForProduct,
  stockAvailabilityHint,
  STOCK_PAYMENT_HOLD_MINUTES,
} from "./stock-availability";
import type { NativeProductRow } from "./native-catalog";

const row = (stock: number): NativeProductRow => ({
  id: "p1",
  name: "Snacks",
  description: null,
  price_cents: 1000,
  compare_at_price_cents: null,
  promo_label: null,
  currency: "COP",
  image_url: null,
  stock_qty: stock,
  allows_additions: 0,
  category: null,
  featured: 0,
});

describe("stockAvailabilityHint", () => {
  it("no muestra texto en ficha", () => {
    expect(
      stockAvailabilityHint({
        row: row(5),
        maxAdd: 0,
        reservedOthers: 5,
      }),
    ).toBeNull();
  });
});

describe("maxAddForProduct", () => {
  it("solo resta holds de pago ajenos", () => {
    const cart = { lines: [], currency: "COP", updatedAt: "" };
    expect(
      maxAddForProduct({ row: row(10), cart, reservedOthers: 3 }),
    ).toBe(7);
  });

  it("sin límite de stock cuando stock_qty es null", () => {
    const cart = { lines: [], currency: "COP", updatedAt: "" };
    const unlimited = { ...row(0), stock_qty: null };
    expect(
      maxAddForProduct({ row: unlimited, cart, reservedOthers: 99 }),
    ).toBe(99);
  });
});

describe("buildNoStockVisitorReply", () => {
  it("mensaje corto sin unidades", () => {
    const text = buildNoStockVisitorReply({
      row: row(3),
      maxAdd: 0,
      reservedOthers: 3,
    });
    expect(text).toBe("Ahora no hay unidades libres");
  });
});

describe("STOCK_PAYMENT_HOLD_MINUTES", () => {
  it("hold de pago 5 minutos", () => {
    expect(STOCK_PAYMENT_HOLD_MINUTES).toBe(5);
  });
});
