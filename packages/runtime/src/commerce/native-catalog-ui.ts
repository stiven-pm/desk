import { COMMERCE_VISITOR_LABEL, NATIVE_COMMERCE_LEAD } from "@chatbot/domain";
import { parseAssistantUi, DESK_UI_FENCE } from "@chatbot/chat-ui";
import type { NativeProductRow } from "./native-catalog";
import { chatCatalogTitle, buildNativeCatalogVisitorFallback } from "./native-catalog";
import { formatCatalogStockLabel } from "./stock-availability";
import { deskCmdProduct } from "@chatbot/domain";

function formatMoneyCents(cents: number, currency: string): string {
  const major = cents / 100;
  const formatted = Number.isInteger(major)
    ? major.toLocaleString("es-CO")
    : major.toLocaleString("es-CO", { minimumFractionDigits: 2 });
  return `${formatted} ${currency}`;
}

function catalogPriceLabel(row: NativeProductRow): string {
  const price = formatMoneyCents(row.price_cents, row.currency);
  const stock = formatCatalogStockLabel(row);
  return stock ? `${price} · ${stock}` : price;
}

function lineLooksLikeInlineProduct(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^▸/.test(t)) return true;
  return (
    /^\*{1,2}[^*]+\*{1,2}\s*[–—-]\s*.+/.test(t) ||
    /^.+[–—-]\s*(\$[\d.,\s]+(?:\s*COP)?|\d[\d.,]*\s*COP)/i.test(t)
  );
}

function stripInlineProductLines(prose: string): string {
  const kept = prose
    .split("\n")
    .filter((line) => !lineLooksLikeInlineProduct(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return kept;
}

function stripDanglingCatalogLeadIns(prose: string): string {
  return prose
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/[:：]\s*$/.test(t)) return false;
      if (/^(te dejo|aquí|mira|abajo|a continuación)\b/i.test(t) && /referencia/i.test(t)) {
        return false;
      }
      if (/^por ahora tenemos disponible/i.test(t) && !/\*\w/.test(t)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type CommerceToolProduct = {
  productId: string;
  name: string;
  displayName?: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  promoLabel?: string;
  compareAtPriceCents?: number;
};

function catalogItemsFromRows(rows: NativeProductRow[], cap = 24) {
  return rows.slice(0, cap).map((r) => ({
    id: r.id,
    title: chatCatalogTitle(r),
    price: catalogPriceLabel(r),
    compareAtPrice:
      r.compare_at_price_cents != null
        ? formatMoneyCents(r.compare_at_price_cents, r.currency)
        : undefined,
    badge: r.promo_label?.trim() || undefined,
    imageUrl: r.image_url ?? undefined,
    prompt: deskCmdProduct(r.id),
  }));
}

export function catalogItemsFromToolProducts(products: CommerceToolProduct[]) {
  return products.slice(0, 24).map((p) => ({
    id: p.productId,
    title: (p.displayName?.trim() || p.name).slice(0, 120),
    price: formatMoneyCents(p.priceCents, p.currency),
    compareAtPrice:
      p.compareAtPriceCents != null
        ? formatMoneyCents(p.compareAtPriceCents, p.currency)
        : undefined,
    badge: p.promoLabel?.trim() || undefined,
    imageUrl: p.imageUrl,
    prompt: deskCmdProduct(p.productId),
  }));
}

function productCatalogDeskUiFence(
  items: ReturnType<typeof catalogItemsFromRows>,
  buttonLabel: string,
): string {
  return `\n\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({
    blocks: [
      {
        type: "product_catalog",
        buttonLabel: buttonLabel.slice(0, 80),
        items,
      },
    ],
  })}\n\`\`\``;
}

function hasCatalogPickerBlock(text: string): boolean {
  const parsed = parseAssistantUi(text);
  return parsed.blocks.some(
    (b) =>
      b.type === "product_catalog" ||
      b.type === "products" ||
      (b.type === "choices" &&
        b.items.some((c) => /ver (productos|cat[aá]logo|opciones)/i.test(c.label))),
  );
}

function cleanCatalogProse(assistantText: string): string {
  const parsed = parseAssistantUi(assistantText);
  let cleanProse = parsed.prose
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/```desk-ui[\s\S]*?```/gi, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  cleanProse = stripInlineProductLines(cleanProse);
  cleanProse = stripDanglingCatalogLeadIns(cleanProse);
  return cleanProse;
}

/** Botón + modal (todos los ítems); adjunta tras commerce_search_products o menú firmado. */
export function mergeProductCatalogPickerDeskUi(
  assistantText: string,
  rows: NativeProductRow[],
  buttonLabel = COMMERCE_VISITOR_LABEL.catalogModalButton,
): string {
  if (!rows.length) return assistantText;
  if (hasCatalogPickerBlock(assistantText)) return assistantText;
  const items = catalogItemsFromRows(rows);
  const cleanProse = cleanCatalogProse(assistantText);
  const fence = productCatalogDeskUiFence(items, buttonLabel);
  if (!cleanProse) return fence.trimStart();
  return `${cleanProse}${fence}`;
}

export function mergeProductCatalogPickerFromToolProducts(
  assistantText: string,
  products: CommerceToolProduct[],
  buttonLabel = COMMERCE_VISITOR_LABEL.catalogModalButton,
): string {
  if (!products.length) return assistantText;
  const items = catalogItemsFromToolProducts(products);
  const cleanProse = cleanCatalogProse(assistantText);
  const fence = productCatalogDeskUiFence(items, buttonLabel);
  if (!cleanProse) return fence.trimStart();
  return `${cleanProse}${fence}`;
}

export function buildProductCatalogPickerDeskUi(
  rows: NativeProductRow[],
  buttonLabel = COMMERCE_VISITOR_LABEL.catalogModalButton,
  intro?: string,
): string {
  if (!rows.length) return buildNativeCatalogVisitorFallback([]);
  const prose = intro?.trim() ?? NATIVE_COMMERCE_LEAD.catalogBrowse;
  return mergeProductCatalogPickerDeskUi(prose, rows, buttonLabel);
}

function nativeProductItems(rows: NativeProductRow[]) {
  return rows.slice(0, 6).map((r) => ({
    id: r.id,
    title: chatCatalogTitle(r),
    price: catalogPriceLabel(r),
    compareAtPrice:
      r.compare_at_price_cents != null
        ? formatMoneyCents(r.compare_at_price_cents, r.currency)
        : undefined,
    badge: r.promo_label?.trim() || undefined,
    prompt: deskCmdProduct(r.id),
  }));
}

function productsDeskUiFence(rows: NativeProductRow[]): string {
  const items = nativeProductItems(rows);
  return `\n\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({
    blocks: [{ type: "products", items }],
  })}\n\`\`\``;
}

/** Prosa del modelo + lista táctil (solo si el runtime adjunta catálogo). */
export function mergeNativeProductsDeskUi(
  assistantText: string,
  rows: NativeProductRow[],
): string {
  if (!rows.length) return assistantText;
  const parsed = parseAssistantUi(assistantText);
  if (parsed.blocks.some((b) => b.type === "products" || b.type === "product_catalog")) {
    return assistantText;
  }
  let cleanProse = parsed.prose
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/```desk-ui[\s\S]*?```/gi, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  cleanProse = stripInlineProductLines(cleanProse);
  cleanProse = stripDanglingCatalogLeadIns(cleanProse);
  const fence = productsDeskUiFence(rows.slice(0, 6));
  if (!cleanProse) return fence.trimStart();
  return `${cleanProse}${fence}`;
}

/** @deprecated use mergeNativeProductsDeskUi */
export function appendNativeProductsDeskUi(
  assistantText: string,
  rows: NativeProductRow[],
): string {
  return mergeNativeProductsDeskUi(assistantText, rows);
}
