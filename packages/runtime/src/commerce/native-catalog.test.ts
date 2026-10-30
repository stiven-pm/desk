import { describe, expect, it } from "vitest";
import {
  formatNativeCatalogPromptSection,
  nativeProductToCatalogEntry,
} from "./native-catalog";

describe("nativeProductToCatalogEntry", () => {
  it("maps row to catalog entry", () => {
    expect(
      nativeProductToCatalogEntry({
        id: "p1",
        name: "Gorra",
        description: null,
        price_cents: 25000,
        compare_at_price_cents: null,
        promo_label: null,
        currency: "COP",
        image_url: null,
        stock_qty: 3,
        allows_additions: 0,
        category: null,
        featured: 0,
      }),
    ).toEqual({ productId: "p1", priceCents: 25000, name: "Gorra" });
  });
});

describe("formatNativeCatalogPromptSection", () => {
  it("includes product name and price", () => {
    const text = formatNativeCatalogPromptSection([
      {
        id: "p1",
        name: "Producto demo",
        description: null,
        price_cents: 2000000,
        compare_at_price_cents: null,
        promo_label: null,
        currency: "COP",
        image_url: "https://cdn.example/x.jpg",
        stock_qty: null,
        allows_additions: 0,
        category: null,
        featured: 0,
      },
    ]);
    expect(text).toContain("Producto demo");
    expect(text).toContain("productId: p1");
    expect(text).toContain("lista táctil");
  });

  it("compact mode omits long descriptions", () => {
    const text = formatNativeCatalogPromptSection(
      [
        {
          id: "p1",
          name: "Producto demo",
          description: "Descripción muy larga que no debería ir al prompt compacto",
          price_cents: 2000000,
          compare_at_price_cents: null,
          promo_label: null,
          currency: "COP",
          image_url: null,
          stock_qty: null,
          allows_additions: 0,
          category: null,
          featured: 0,
        },
      ],
      { compact: true, totalPublished: 50 },
    );
    expect(text).not.toContain("Descripción muy larga");
    expect(text).toContain("50 productos");
  });
});
