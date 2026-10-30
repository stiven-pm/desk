import { describe, expect, it } from "vitest";
import { CommerceService } from "./commerce-service";

function metaStore() {
  const m = new Map<string, string>();
  return {
    get: (k: string) => m.get(k) ?? null,
    set: (k: string, v: string) => m.set(k, v),
  };
}

describe("CommerceService.cartAdd", () => {
  it("rechaza precio LLM si hay herramientas de catálogo", async () => {
    const svc = new CommerceService({
      meta: metaStore(),
      orgId: "o1",
      botId: "b1",
      conversationId: "c1",
      hasCatalogHttpTools: true,
    });
    const result = await svc.cartAdd({
      productId: "x",
      name: "Producto",
      priceCents: 1000,
    });
    expect(result).toEqual({
      ok: false,
      code: "price_must_come_from_catalog_tool",
      hint: expect.stringContaining("herramienta"),
    });
  });

  it("usa precio en caché de catálogo", async () => {
    const svc = new CommerceService({
      meta: metaStore(),
      orgId: "o1",
      botId: "b1",
      conversationId: "c1",
      hasCatalogHttpTools: true,
    });
    svc.recordCatalogPrices([
      { productId: "sku-1", priceCents: 4500, name: "Gorra" },
    ]);
    const result = await svc.cartAdd({
      productId: "sku-1",
      name: "Gorra",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cart.lines[0].priceCents).toBe(4500);
    }
  });

  it("acepta precio LLM sin catálogo y emite evento", async () => {
    const events: string[] = [];
    const svc = new CommerceService({
      meta: metaStore(),
      orgId: "o1",
      botId: "b1",
      conversationId: "c1",
      hasCatalogHttpTools: false,
      trackEvent: (name) => events.push(name),
    });
    const result = await svc.cartAdd({
      productId: "local-1",
      name: "Artesanal",
      priceCents: 1200,
    });
    expect(result.ok).toBe(true);
    expect(events).toContain("cart.price_from_llm");
  });
});
