import { describe, expect, it } from "vitest";
import {
  extractCatalogPricesFromToolOutput,
  isCatalogHttpTool,
} from "./catalog-price";

describe("isCatalogHttpTool", () => {
  it("detects product list tools", () => {
    expect(
      isCatalogHttpTool("shopify_list_products", "Lista productos"),
    ).toBe(true);
    expect(isCatalogHttpTool("get_invoice", "Facturas cliente")).toBe(false);
  });
});

describe("extractCatalogPricesFromToolOutput", () => {
  it("parses wrapped http tool JSON", () => {
    const inner = JSON.stringify({
      products: [{ id: "sku-1", name: "Camiseta", price: "29.99" }],
    });
    const output = JSON.stringify({ status: 200, ok: true, body: inner });
    const prices = extractCatalogPricesFromToolOutput(output);
    expect(prices).toEqual([
      { productId: "sku-1", priceCents: 2999, name: "Camiseta" },
    ]);
  });
});
