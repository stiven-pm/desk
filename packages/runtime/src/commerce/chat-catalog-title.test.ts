import { describe, expect, it } from "vitest";
import { chatCatalogTitle, chatCatalogDescription } from "./native-catalog";
import type { NativeProductRow } from "./native-catalog";

const base: NativeProductRow = {
  id: "p1",
  name: "Snacks combo",
  description: "16 SNACKS DE POLLO CON PAPITAS\nPUEDES AGREGARLE SALSA",
  price_cents: 2000000,
  compare_at_price_cents: null,
  promo_label: null,
  currency: "COP",
  image_url: null,
  stock_qty: 45,
  allows_additions: 1,
  category: null,
  featured: 0,
};

describe("chatCatalogTitle", () => {
  it("usa el nombre publicado, no la descripción", () => {
    expect(chatCatalogTitle(base)).toBe("Snacks combo");
  });
});

describe("chatCatalogDescription", () => {
  it("no repite la primera línea si coincide con el título", () => {
    const row = {
      ...base,
      name: "16 SNACKS DE POLLO CON PAPITAS A LA FRANCESA Y SALSA BBB",
      description:
        "16 SNACKS DE POLLO CON PAPITAS A LA FRANCESA Y SALSA BBB\nPUEDES AGREGARLE SALSA ROSADA",
    };
    expect(chatCatalogDescription(row)).toContain("PUEDES AGREGARLE");
    expect(chatCatalogDescription(row)).not.toMatch(/^16 SNACKS/);
  });
});
