import { DESK_UI_FENCE } from "@chatbot/chat-ui";
import { deskCmdProduct } from "@chatbot/domain";
import type { CatalogPriceEntry } from "./catalog-price";
import {
  buildFtsAndMatchQuery,
  buildFtsOrMatchQuery,
  COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT,
  NATIVE_MENU_BROWSE_LIMIT,
  tokenizeCatalogSearchTerms,
  visitorCatalogSearchTerms,
} from "./catalog-search";

export type NativeProductRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  promo_label: string | null;
  currency: string;
  image_url: string | null;
  stock_qty: number | null;
  allows_additions: number;
  category: string | null;
  featured: number;
};

/** Título visible en chat (modal, ficha, carrito). Siempre el nombre publicado en catálogo. */
export function chatCatalogTitle(row: NativeProductRow): string {
  const name = row.name?.trim() ?? "";
  if (name.length >= 1) return name.slice(0, 120);
  const descLine = row.description?.trim().split(/\n/)[0]?.trim() ?? "";
  return descLine.slice(0, 120) || "Producto";
}

/** Descripción para ficha HTML sin repetir el título. */
export function chatCatalogDescription(row: NativeProductRow): string {
  const raw = row.description?.trim() ?? "";
  if (!raw) return "";
  const title = chatCatalogTitle(row);
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  if (lines[0].toLowerCase() === title.toLowerCase()) {
    return lines.slice(1).join("\n").trim().slice(0, 400);
  }
  if (raw.toLowerCase().startsWith(title.toLowerCase()) && raw.length <= title.length + 2) {
    return "";
  }
  return raw.slice(0, 400);
}

function normalizeProductRow(row: NativeProductRow): NativeProductRow {
  const stockRaw = row.stock_qty as number | string | null | undefined;
  let stock_qty: number | null = null;
  if (stockRaw != null && stockRaw !== "") {
    const n = Number(stockRaw);
    stock_qty = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  }
  return {
    ...row,
    stock_qty,
    allows_additions: Number(row.allows_additions) ? 1 : 0,
    featured: Number(row.featured) ? 1 : 0,
  };
}

const PRODUCT_SELECT = `id, name, description, price_cents, compare_at_price_cents, promo_label,
  currency, image_url, stock_qty, allows_additions, category, featured`;

export async function countPublishedProducts(
  db: D1Database,
  orgId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM products WHERE org_id = ? AND status = 'published'`,
    )
    .bind(orgId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function orgHasPublishedProducts(
  db: D1Database,
  orgId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM products WHERE org_id = ? AND status = 'published'`,
    )
    .bind(orgId)
    .first<{ n: number }>();
  return (row?.n ?? 0) > 0;
}

export async function getPublishedProduct(
  db: D1Database,
  orgId: string,
  productId: string,
): Promise<NativeProductRow | null> {
  const row =
    (await db
      .prepare(
        `SELECT ${PRODUCT_SELECT}
         FROM products WHERE org_id = ? AND id = ? AND status = 'published'`,
      )
      .bind(orgId, productId)
      .first<NativeProductRow>()) ?? null;
  return row ? normalizeProductRow(row) : null;
}

export async function listPublishedProductCategories(
  db: D1Database,
  orgId: string,
  limit = 8,
): Promise<string[]> {
  const cap = Math.min(12, Math.max(1, limit));
  const rows = await db
    .prepare(
      `SELECT DISTINCT trim(category) AS label
       FROM products
       WHERE org_id = ? AND status = 'published'
         AND category IS NOT NULL AND trim(category) != ''
       ORDER BY label COLLATE NOCASE
       LIMIT ?`,
    )
    .bind(orgId, cap)
    .all<{ label: string }>();
  return (rows.results ?? []).map((r) => r.label).filter(Boolean);
}

export type PublishedProductSearchResult = {
  rows: NativeProductRow[];
  relaxed?: boolean;
};

async function queryPublishedByFts(
  db: D1Database,
  orgId: string,
  matchQuery: string,
  limit: number,
): Promise<NativeProductRow[]> {
  if (!matchQuery.trim()) return [];
  const sql = `SELECT ${PRODUCT_SELECT}
       FROM products p
       INNER JOIN products_fts fts ON fts.rowid = p.rowid
       WHERE p.org_id = ? AND p.status = 'published' AND fts MATCH ?
       ORDER BY p.featured DESC, p.updated_at DESC
       LIMIT ?`;
  const rows = await db
    .prepare(sql)
    .bind(orgId, matchQuery, limit)
    .all<NativeProductRow>();
  return (rows.results ?? []).map(normalizeProductRow);
}

async function queryPublishedBySearchTokens(
  db: D1Database,
  orgId: string,
  tokens: string[],
  limit: number,
  match: "and" | "or",
): Promise<NativeProductRow[]> {
  const matchQuery =
    match === "and" ? buildFtsAndMatchQuery(tokens) : buildFtsOrMatchQuery(tokens);
  return queryPublishedByFts(db, orgId, matchQuery, limit);
}

export async function listPublishedProductsBrowse(
  db: D1Database,
  orgId: string,
  limit = COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT,
): Promise<NativeProductRow[]> {
  const cap = Math.min(NATIVE_MENU_BROWSE_LIMIT, Math.max(1, limit));
  const rows = await db
    .prepare(
      `SELECT ${PRODUCT_SELECT}
         FROM products WHERE org_id = ? AND status = 'published'
         ORDER BY featured DESC,
           CASE WHEN promo_label IS NOT NULL AND trim(promo_label) != '' THEN 1 ELSE 0 END DESC,
           updated_at DESC
         LIMIT ?`,
    )
    .bind(orgId, cap)
    .all<NativeProductRow>();
  return (rows.results ?? []).map(normalizeProductRow);
}

export async function searchPublishedProducts(
  db: D1Database,
  orgId: string,
  query: string,
  limit = COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT,
): Promise<PublishedProductSearchResult> {
  const terms = visitorCatalogSearchTerms(query);
  const tokens = tokenizeCatalogSearchTerms(terms);
  const cap = Math.min(COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT, Math.max(1, limit));
  if (!tokens.length) {
    return { rows: await listPublishedProductsBrowse(db, orgId, cap) };
  }
  let rows = await queryPublishedBySearchTokens(db, orgId, tokens, cap, "and");
  if (!rows.length && tokens.length > 1) {
    rows = await queryPublishedBySearchTokens(db, orgId, tokens, cap, "or");
    if (rows.length) {
      return { rows, relaxed: true };
    }
  }
  return { rows };
}

export function nativeProductToCatalogEntry(
  row: NativeProductRow,
): CatalogPriceEntry {
  return {
    productId: row.id,
    priceCents: row.price_cents,
    name: row.name,
  };
}

function formatMoneyCents(cents: number, currency: string): string {
  const major = cents / 100;
  const formatted = Number.isInteger(major)
    ? major.toLocaleString("es-CO")
    : major.toLocaleString("es-CO", { minimumFractionDigits: 2 });
  return `${formatted} ${currency}`;
}

/** Texto para el system prompt cuando hay catálogo nativo publicado. */
/** Respuesta determinista cuando Workers AI falla pero hay catálogo nativo. */
export function buildNativeCatalogVisitorFallback(rows: NativeProductRow[]): string {
  if (!rows.length) {
    return "Por ahora no tengo productos publicados para mostrarte. ¿Te gustaría hablar con alguien del equipo?";
  }
  const intro =
    "Estos son los productos publicados. Escríbeme cuál te interesa o tócalo en la lista.";
  const items = rows.slice(0, 6).map((r) => ({
    id: r.id,
    title: r.name,
    price: formatMoneyCents(r.price_cents, r.currency),
    compareAtPrice:
      r.compare_at_price_cents != null
        ? formatMoneyCents(r.compare_at_price_cents, r.currency)
        : undefined,
    badge: r.promo_label?.trim() || undefined,
    prompt: deskCmdProduct(r.id),
  }));
  const fence = `\n\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({
    blocks: [{ type: "products", items }],
  })}\n\`\`\``;
  return `${intro}${fence}`;
}

export function buildCatalogBrowseIntro(
  totalPublished: number,
  shownCount: number,
  categoryLabels: string[] = [],
): string {
  if (totalPublished <= 0) {
    return "Por ahora no hay productos publicados. ¿Te ayudo con otra cosa?";
  }
  if (totalPublished === 1) {
    return "Este es lo que tenemos publicado ahora. Revísalo abajo o dime si lo quieres armar.";
  }
  const cats = categoryLabels.filter(Boolean);
  if (totalPublished > shownCount && cats.length >= 2) {
    const sample = cats.slice(0, 4).join(", ");
    const more = cats.length > 4 ? "…" : "";
    return `Hay ${totalPublished} productos (${sample}${more}). Te muestro ${shownCount} para empezar; dime qué buscas o una categoría.`;
  }
  if (totalPublished > shownCount) {
    return `Hay ${totalPublished} productos publicados. Te muestro ${shownCount} para empezar; dime qué buscas si quieres acotar.`;
  }
  return "Elige en la lista o dime qué te interesa.";
}

export function formatNativeCatalogPromptSection(
  rows: NativeProductRow[],
  opts?: { compact?: boolean; totalPublished?: number },
): string {
  if (!rows.length) return "";
  const compact = opts?.compact === true;
  const total = opts?.totalPublished ?? rows.length;
  const lines = rows.slice(0, compact ? 10 : 12).map((r) => {
    const price = formatMoneyCents(r.price_cents, r.currency);
    if (compact) {
      return `- ${r.name} (productId: ${r.id}): ${price}`;
    }
    const bits = [`- ${r.name} (productId: ${r.id}): ${price}`];
    if (r.compare_at_price_cents != null) {
      bits.push(`  antes: ${formatMoneyCents(r.compare_at_price_cents, r.currency)}`);
    }
    if (r.promo_label?.trim()) bits.push(`  promo: ${r.promo_label.trim()}`);
    if (r.stock_qty != null) bits.push(`  stock: ${r.stock_qty}`);
    if (r.description?.trim()) bits.push(`  ${r.description.trim().slice(0, 160)}`);
    if (r.image_url?.trim()) bits.push(`  imageUrl: ${r.image_url.trim()}`);
    return bits.join("\n");
  });
  const tail =
    compact
      ? [
          total > rows.length
            ? `(${total} productos publicados en total; no enumeres todos en prosa.)`
            : "",
          "Referencia interna: nombres y precios autorizados. No copies descripciones largas al visitante si el runtime muestra lista táctil; responde en 1–2 frases y deja detalle en la lista o en un producto concreto.",
        ]
          .filter(Boolean)
          .join("\n")
      : "Usa esta lista como fuente de verdad para nombres, precios y descripciones. Interpreta la intención del visitante según las instrucciones de la empresa (no asumas un rubro). Responde en prosa natural; el runtime solo añade la lista táctil cuando el visitante pide ver catálogo/menú o armar pedido.";
  return ["## Catálogo publicado", lines.join("\n"), tail].join("\n");
}

export function nativeProductToToolJson(row: NativeProductRow): Record<string, unknown> {
  return {
    productId: row.id,
    name: row.name,
    displayName: chatCatalogTitle(row),
    description: row.description,
    priceCents: row.price_cents,
    compareAtPriceCents: row.compare_at_price_cents ?? undefined,
    promoLabel: row.promo_label ?? undefined,
    currency: row.currency,
    imageUrl: row.image_url ?? undefined,
    stockQty: row.stock_qty ?? undefined,
  };
}
