import {
  CATALOG_SLOT_TITLE,
  LEGACY_CREDENTIALS_DOCUMENT_TITLE,
} from "@/components/business-knowledge-slots";

const LEGACY_CATALOG_TITLE = "Catálogo (referencia)";

export type SetupChecklistDoc = { title: string; status: string };

export function hasPersonalityInstructions(systemPrompt: string | null | undefined): boolean {
  return Boolean(systemPrompt?.trim());
}

/** Conocimiento indexado: PDFs útiles o catálogo nativo con al menos un producto. */
export function hasKnowledgeForAssistant(
  docs: SetupChecklistDoc[],
  productCount: number,
): boolean {
  if (productCount > 0) return true;
  return docs.some(
    (d) =>
      d.status === "ready" &&
      d.title !== LEGACY_CREDENTIALS_DOCUMENT_TITLE &&
      (d.title === CATALOG_SLOT_TITLE ||
        d.title === LEGACY_CATALOG_TITLE ||
        d.title === "Políticas" ||
        d.title === "Preguntas frecuentes" ||
        d.title === "Material adicional" ||
        (![
          CATALOG_SLOT_TITLE,
          LEGACY_CATALOG_TITLE,
          "Políticas",
          "Preguntas frecuentes",
        ].includes(d.title) &&
          d.title.trim().length > 0)),
  );
}
