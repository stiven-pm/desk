import type { Env } from "../types";
import {
  executeIntegrationCapability,
  findOperation,
  loadOrgCommerceCatalogBundle,
  mapCatalogItems,
} from "@chatbot/runtime/integrations/integration-runtime";
import {
  listPublishedProductsForOrgSlug,
  type PublicStorefrontProduct,
} from "./public-storefront-products";

export type CatalogListResult =
  | {
      ok: true;
      orgId: string;
      products: PublicStorefrontProduct[];
      source: "native" | "integration";
    }
  | { ok: false; error: "not_found" | "inactive" };

/** Capa única para la tienda hosted: catálogo nativo D1 o integración conectada. */
export async function listStorefrontCatalogForSlug(
  env: Env,
  orgSlug: string,
  limit = 100,
): Promise<CatalogListResult> {
  const native = await listPublishedProductsForOrgSlug(env, orgSlug, limit);
  if (!native.ok) return native;
  if (native.products.length > 0) {
    return {
      ok: true,
      orgId: native.orgId,
      products: native.products,
      source: "native",
    };
  }

  const bundle = await loadOrgCommerceCatalogBundle(
    env.DB,
    native.orgId,
    env.ENCRYPTION_KEY,
  );
  if (!bundle || !findOperation(bundle, "catalog.search")) {
    return { ok: true, orgId: native.orgId, products: [], source: "native" };
  }

  const result = await executeIntegrationCapability(bundle, "catalog.search", {
    query: "",
    limit: String(limit),
  });
  if (!result.ok) {
    return {
      ok: true,
      orgId: native.orgId,
      products: [],
      source: "integration",
    };
  }
  const op = findOperation(bundle, "catalog.search");
  if (!op) {
    return {
      ok: true,
      orgId: native.orgId,
      products: [],
      source: "integration",
    };
  }
  const items = mapCatalogItems(result.bodyJson, op);
  const products: PublicStorefrontProduct[] = items.slice(0, limit).map((p) => ({
    id: p.productId,
    name: p.name,
    description: null,
    priceCents: p.priceCents,
    compareAtPriceCents: null,
    promoLabel: null,
    currency: p.currency,
    imageUrl: null,
    stockQty: p.stock ?? null,
    allowsAdditions: false,
  }));

  return {
    ok: true,
    orgId: native.orgId,
    products,
    source: "integration",
  };
}
