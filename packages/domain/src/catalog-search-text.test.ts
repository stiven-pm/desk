import { describe, expect, it } from "vitest";
import { buildProductSearchText, normalizeCatalogText } from "./catalog-search-text";

describe("normalizeCatalogText", () => {
  it("folds Spanish accents", () => {
    expect(normalizeCatalogText("Jamón")).toBe("jamon");
    expect(normalizeCatalogText("Té")).toBe("te");
  });
});

describe("buildProductSearchText", () => {
  it("merges name, description and category", () => {
    expect(
      buildProductSearchText({
        name: "Café",
        description: "Colombiano",
        category: "Bebidas",
      }),
    ).toBe("cafe colombiano bebidas");
  });
});
