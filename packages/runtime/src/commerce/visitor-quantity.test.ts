import { describe, expect, it } from "vitest";
import {
  maxAddQuantityForRow,
  parseVisitorQuantityMessage,
  validateAddQuantityForRow,
} from "./visitor-quantity";
import type { NativeProductRow } from "./native-catalog";

const row = (stock: number | null): NativeProductRow => ({
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

describe("parseVisitorQuantityMessage", () => {
  it("acepta enteros simples", () => {
    expect(parseVisitorQuantityMessage("10")).toBe(10);
    expect(parseVisitorQuantityMessage(" 3 ")).toBe(3);
  });

  it("acepta sufijo corto opcional", () => {
    expect(parseVisitorQuantityMessage("5 unidades")).toBe(5);
    expect(parseVisitorQuantityMessage("2x")).toBe(2);
  });

  it("rechaza texto libre", () => {
    expect(parseVisitorQuantityMessage("diez")).toBeNull();
    expect(parseVisitorQuantityMessage("10 y media")).toBeNull();
  });
});

describe("maxAddQuantityForRow", () => {
  it("resta lo ya en carrito y reservas ajenas", () => {
    const cart = {
      lines: [{ productId: "p1", name: "Snacks", priceCents: 1, quantity: 3, currency: "COP" }],
      currency: "COP",
    };
    expect(maxAddQuantityForRow(row(45), cart, 0)).toBe(42);
    expect(maxAddQuantityForRow(row(45), cart, 5)).toBe(37);
    expect(maxAddQuantityForRow(row(5), cart, 5)).toBe(0);
  });
});

describe("validateAddQuantityForRow", () => {
  it("respeta stock y carrito", () => {
    const cart = {
      lines: [{ productId: "p1", name: "Snacks", priceCents: 1, quantity: 3, currency: "COP" }],
      currency: "COP",
    };
    expect(validateAddQuantityForRow(row(45), 45, cart, 0)).toEqual({
      ok: false,
      message: "Solo puedes añadir hasta 42 unidades más (stock y carrito).",
    });
    expect(validateAddQuantityForRow(row(45), 42, cart, 0)).toEqual({
      ok: true,
      quantity: 42,
    });
  });
});
