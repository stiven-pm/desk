import {
  parseCatalogLinesFromText,
  type CatalogImportDraftPayload,
} from "@chatbot/domain";
import type { Env } from "../types";

export async function buildCatalogDraftFromUpload(
  env: Env,
  file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> },
  currency = "COP",
): Promise<CatalogImportDraftPayload> {
  const buf = await file.arrayBuffer();
  const contentType = file.type || "application/pdf";
  const name = file.name.trim() || "catalog.pdf";
  let text = "";

  try {
    const blob = new Blob([buf], { type: contentType });
    const res = await env.AI.toMarkdown({ name, blob });
    if (res.format === "markdown" && res.data.trim()) {
      text = res.data;
    }
  } catch {
    /* fallback below */
  }
  if (!text.trim()) {
    text = new TextDecoder().decode(buf);
  }

  return parseCatalogLinesFromText(text.trim(), {
    currency,
    sourceFilename: name,
  });
}
