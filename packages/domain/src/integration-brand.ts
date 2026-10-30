/** Marca visual compartida (panel, marketing, docs). */

import { catalogEntryById } from "./integration-catalog";

export interface IntegrationBrand {
  /** Slug en cdn.simpleicons.org (sin # en color). */
  simpleIcon?: string;
  /** Color hex sin `#` — fondo de iniciales o tinte del icono. */
  iconColor?: string;
}

/** Tiles de UI que no son entradas BYOK del catálogo. */
export const INTEGRATION_EXTRA_TILE_BRANDS: Record<string, IntegrationBrand> = {
  developer: { iconColor: "4F46E5" },
  webhooks: { iconColor: "0F172A" },
};

export function integrationExtraTileBrand(tileId: string): IntegrationBrand | undefined {
  return INTEGRATION_EXTRA_TILE_BRANDS[tileId];
}

export function integrationBrandInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** URL de icono en Simple Icons CDN; `null` si no hay slug (usar iniciales). */
export function integrationSimpleIconCdnUrl(
  brand: IntegrationBrand | undefined,
): string | null {
  if (!brand?.simpleIcon) return null;
  const color = (brand.iconColor ?? "64748b").replace(/^#/, "");
  return `https://cdn.simpleicons.org/${brand.simpleIcon}/${color}`;
}

export function resolveIntegrationBrand(
  catalogId: string,
  catalogBrand?: IntegrationBrand,
): IntegrationBrand | undefined {
  return catalogBrand ?? integrationExtraTileBrand(catalogId);
}

/** IDs usados en copy de marketing → catálogo BYOK. */
const MARKETING_ID_ALIASES: Record<string, string> = {
  sheets: "google_sheets",
};

export function marketingConnectorBrand(marketingOrCatalogId: string): IntegrationBrand | undefined {
  if (marketingOrCatalogId === "webhook") {
    return integrationExtraTileBrand("webhooks");
  }
  const catalogId =
    MARKETING_ID_ALIASES[marketingOrCatalogId] ?? marketingOrCatalogId;
  return (
    catalogEntryById(catalogId)?.brand ?? integrationExtraTileBrand(catalogId)
  );
}
