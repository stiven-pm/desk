/** Heurística: herramientas HTTP que listan o consultan catálogo (precio autorizado). */
export function isCatalogHttpTool(name: string, description: string): boolean {
  const blob = `${name} ${description}`.toLowerCase();
  return /product|item|catalog|sku|inventor|stock|woocommerce|shopify/.test(blob);
}

export type CatalogPriceEntry = {
  productId: string;
  priceCents: number;
  name?: string;
};

function toCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value) && value >= 100) return Math.round(value);
    if (value > 0 && value < 1_000_000) return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n < 1_000_000 ? Math.round(n * 100) : Math.round(n);
  }
  return null;
}

function idFromRecord(row: Record<string, unknown>): string | null {
  for (const key of ["id", "sku", "product_id", "productId", "variant_id"]) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim().slice(0, 64);
  }
  return null;
}

function priceFromRecord(row: Record<string, unknown>): number | null {
  for (const key of [
    "priceCents",
    "price_cents",
    "regular_price",
    "price",
    "sale_price",
    "unit_price",
  ]) {
    const cents = toCents(row[key]);
    if (cents != null) return cents;
  }
  return null;
}

function nameFromRecord(row: Record<string, unknown>): string | undefined {
  for (const key of ["name", "title", "product_name"]) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim().slice(0, 200);
  }
  return undefined;
}

function walkForProducts(node: unknown, out: CatalogPriceEntry[], depth: number): void {
  if (depth > 6 || out.length > 48) return;
  if (Array.isArray(node)) {
    for (const item of node) walkForProducts(item, out, depth + 1);
    return;
  }
  if (!node || typeof node !== "object") return;
  const row = node as Record<string, unknown>;
  const productId = idFromRecord(row);
  const priceCents = priceFromRecord(row);
  if (productId && priceCents != null) {
    out.push({ productId, priceCents, name: nameFromRecord(row) });
  }
  for (const v of Object.values(row)) {
    if (v && typeof v === "object") walkForProducts(v, out, depth + 1);
  }
}

/** Best-effort: extrae IDs y precios de respuestas JSON de APIs de catálogo. */
export function extractCatalogPricesFromToolOutput(
  output: string,
): CatalogPriceEntry[] {
  try {
    const parsed = JSON.parse(output) as { body?: string };
    const bodyText =
      typeof parsed.body === "string" ? parsed.body : output;
    const data = JSON.parse(bodyText) as unknown;
    const found: CatalogPriceEntry[] = [];
    walkForProducts(data, found, 0);
    const byId = new Map<string, CatalogPriceEntry>();
    for (const e of found) byId.set(e.productId, e);
    return [...byId.values()];
  } catch {
    return [];
  }
}
