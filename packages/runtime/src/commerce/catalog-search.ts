function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

/** Palabras vacías al acotar búsqueda (español genérico, sin rubro). */
const SEARCH_STOP = new Set([
  "que",
  "cual",
  "cuales",
  "como",
  "donde",
  "hay",
  "tienes",
  "tienen",
  "tiene",
  "venden",
  "vende",
  "vendemos",
  "productos",
  "producto",
  "servicios",
  "servicio",
  "catalogo",
  "carta",
  "menu",
  "ver",
  "mostrar",
  "muestrame",
  "muestra",
  "ensename",
  "enseña",
  "dame",
  "pasame",
  "pasa",
  "quiero",
  "quisiera",
  "algo",
  "algun",
  "alguna",
  "unos",
  "unas",
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
  "y",
  "o",
  "en",
  "es",
  "son",
  "esta",
  "este",
  "empresa",
  "negocio",
  "tienda",
  "ofrece",
  "ofrecen",
  "oferta",
  "hola",
  "qhubo",
  "buenas",
  "por",
  "favor",
  "please",
  "busco",
  "buscar",
  "necesito",
  "dedican",
  "dedica",
  "trata",
]);

/**
 * Términos útiles para filtrar catálogo a partir del query de la tool (no enrutamiento).
 * Sin tokens útiles → browse destacados en searchPublishedProducts.
 */
export function visitorCatalogSearchTerms(userText: string): string {
  const raw = userText.trim();
  if (!raw) return "";
  const tokens = normalize(raw)
    .split(/[^a-z0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !SEARCH_STOP.has(w));
  return [...new Set(tokens)].join(" ").slice(0, 80);
}

export function tokenizeCatalogSearchTerms(terms: string): string[] {
  if (!terms.trim()) return [];
  return terms
    .split(/\s+/)
    .map((t) => t.replace(/[%_]/g, "").trim())
    .filter((t) => t.length > 0);
}
