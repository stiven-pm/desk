import { normalizeCatalogText } from "@chatbot/domain";

function normalize(text: string): string {
  return normalizeCatalogText(text);
}

/** Stopwords gramaticales (ES) — solo validación de forma en la tool; búsqueda D1 usa FTS5. */
const FORM_STOP = new Set([
  "que",
  "como",
  "donde",
  "para",
  "con",
  "sin",
  "del",
  "de",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "en",
  "es",
  "son",
  "esta",
  "este",
  "al",
  "le",
  "se",
  "su",
  "sus",
]);

export type CommerceProductSearchMode = "browse" | "search";

export type CommerceSearchDegradeReason =
  | "invalid_mode"
  | "too_long"
  | "no_tokens";

export type CommerceProductSearchResolution = {
  mode: CommerceProductSearchMode;
  queryForSql: string;
  degraded?: boolean;
  degradeReason?: CommerceSearchDegradeReason;
};

export const MAX_SEARCH_QUERY_WORDS = 5;

/** Límite por defecto de `commerce_search_products` (D1 e integración). */
export const COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT = 12;

/** Productos en menú nativo (`__desk:menu__`). */
export const NATIVE_MENU_BROWSE_LIMIT = 24;

/** Destacados compactos en hint RAG del agente (browse fijo, sin NL). */
export const RAG_CATALOG_BROWSE_HINT_LIMIT = 12;

/**
 * Términos útiles para filtrar catálogo (solo argumento `query` de la tool).
 * Sin tokens útiles → cadena vacía (el caller degrada a browse).
 */
export function visitorCatalogSearchTerms(userText: string): string {
  const raw = userText.trim();
  if (!raw) return "";
  const tokens = normalize(raw)
    .split(/[^a-z0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !FORM_STOP.has(w));
  return [...new Set(tokens)].join(" ").slice(0, 80);
}

export function tokenizeCatalogSearchTerms(terms: string): string[] {
  if (!terms.trim()) return [];
  return terms
    .split(/\s+/)
    .map((t) => t.replace(/[%_"]/g, "").trim())
    .filter((t) => t.length > 0);
}

/** Escapa tokens para FTS5 MATCH (AND). */
export function buildFtsAndMatchQuery(tokens: string[]): string {
  if (!tokens.length) return "";
  return tokens
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" ");
}

/** Escapa tokens para FTS5 MATCH (OR). */
export function buildFtsOrMatchQuery(tokens: string[]): string {
  if (!tokens.length) return "";
  return tokens
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" OR ");
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function degradedBrowse(
  reason: CommerceSearchDegradeReason,
): CommerceProductSearchResolution {
  return {
    mode: "browse",
    queryForSql: "",
    degraded: true,
    degradeReason: reason,
  };
}

/** Resuelve mode + query de `commerce_search_products` (validación de forma, no NLU). */
export function resolveCommerceProductSearch(args: {
  mode?: unknown;
  query?: unknown;
}): CommerceProductSearchResolution {
  const modeRaw = String(args.mode ?? "")
    .trim()
    .toLowerCase();
  const queryRaw = String(args.query ?? "").trim().slice(0, 200);

  if (modeRaw === "browse") {
    return { mode: "browse", queryForSql: "" };
  }

  if (modeRaw === "search") {
    if (!queryRaw.trim()) {
      return degradedBrowse("no_tokens");
    }
    if (wordCount(queryRaw) > MAX_SEARCH_QUERY_WORDS) {
      return degradedBrowse("too_long");
    }
    const terms = visitorCatalogSearchTerms(queryRaw);
    if (!terms) {
      return degradedBrowse("no_tokens");
    }
    return { mode: "search", queryForSql: terms };
  }

  return degradedBrowse("invalid_mode");
}
