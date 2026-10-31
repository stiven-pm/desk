/** Misma normalización que tokens de búsqueda en chat (minúsculas, sin marcas). */
export function normalizeCatalogText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

/** Texto indexado en D1 (`products.search_text`) al crear/editar producto. */
export function buildProductSearchText(parts: {
  name: string;
  description?: string | null;
  category?: string | null;
}): string {
  const chunks = [parts.name, parts.description ?? "", parts.category ?? ""]
    .map((s) => normalizeCatalogText(String(s)))
    .filter((s) => s.length > 0);
  return chunks.join(" ").slice(0, 2000);
}
