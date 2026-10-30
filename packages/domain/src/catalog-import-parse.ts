import { z } from "zod";

export const catalogImportItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().min(0),
  confidence: z.enum(["high", "low"]).default("low"),
});

export const catalogImportDraftPayloadSchema = z.object({
  sourceFilename: z.string().max(256),
  extractedChars: z.number().int().min(0),
  currency: z.string().max(8).default("COP"),
  items: z.array(catalogImportItemSchema).max(500),
  warnings: z.array(z.string().max(300)).max(20),
});

export type CatalogImportDraftPayload = z.infer<
  typeof catalogImportDraftPayloadSchema
>;

const PRICE_RE =
  /(?:\$|COP|USD)?\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s*(?:COP|USD)?/i;

function parsePriceToCents(raw: string, _currency: string): number | null {
  const m = raw.match(PRICE_RE);
  if (!m) return null;
  let num = m[1].replace(/\./g, "").replace(",", ".");
  if (/,\d{2}$/.test(m[1]) && !m[1].includes(".")) {
    num = m[1].replace(",", ".");
  }
  const v = Number.parseFloat(num);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 100);
}

/** Heurística sobre texto extraído (PDF/DOCX → markdown). Revisar en panel antes de publicar. */
export function parseCatalogLinesFromText(
  text: string,
  opts?: { currency?: string; sourceFilename?: string },
): CatalogImportDraftPayload {
  const currency = opts?.currency ?? "COP";
  const warnings: string[] = [];
  const items: CatalogImportDraftPayload["items"] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter((l) => l.length > 2);

  for (const line of lines) {
    if (line.length > 400) continue;
    const priceCents = parsePriceToCents(line, currency);
    if (priceCents == null) continue;
    const name = line
      .replace(PRICE_RE, "")
      .replace(/\s{2,}/g, " ")
      .replace(/[-–—:|]+$/g, "")
      .trim();
    if (name.length < 2) continue;
    items.push({
      name: name.slice(0, 200),
      priceCents,
      confidence: name.length >= 4 ? "high" : "low",
    });
  }

  const seen = new Set<string>();
  const deduped = items.filter((it) => {
    const k = `${it.name.toLowerCase()}|${it.priceCents}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!deduped.length) {
    warnings.push(
      "No se detectaron líneas con precio. Revisa el PDF o crea productos manualmente.",
    );
  }
  if (deduped.length > 200) {
    warnings.push("Se recortó a 200 ítems; divide el catálogo si hace falta.");
  }

  return catalogImportDraftPayloadSchema.parse({
    sourceFilename: opts?.sourceFilename ?? "catalog.pdf",
    extractedChars: text.length,
    currency,
    items: deduped.slice(0, 200),
    warnings,
  });
}
