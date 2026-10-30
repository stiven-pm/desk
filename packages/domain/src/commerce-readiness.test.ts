import { describe, expect, it } from "vitest";
import { computeCommerceReadiness } from "./commerce-readiness";
import { parseCommerceManifest } from "./commerce-manifest";

describe("computeCommerceReadiness", () => {
  it("requires catalog, payment and publishable key to sell", () => {
    const manifest = parseCommerceManifest(
      JSON.stringify({
        commerceProfile: "product_sales",
        onboardingProfile: { completedAt: "2026-01-01T00:00:00.000Z" },
      }),
    );
    const snap = computeCommerceReadiness({
      manifest,
      commerceMode: "order_only",
      publishedProductCount: 1,
      readyDocuments: 0,
      activeHttpTools: 0,
      pendingCatalogImports: 0,
      catalogPdfReady: 0,
      paymentProviderActive: true,
      hasPublishableKey: true,
    });
    expect(snap.readyToSell).toBe(true);
    expect(snap.items.find((i) => i.id === "payment")?.ok).toBe(true);
  });
});
