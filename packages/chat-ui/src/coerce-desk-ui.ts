import { deskUiPayloadSchema } from "./schema";
import { DESK_UI_FENCE } from "./types";

/** JSON suelto al final (o mensaje entero) que el modelo a veces emite sin ```desk-ui```. */
export function splitTrailingDeskUiJson(text: string): {
  prose: string;
  payloadJson: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed.includes('"blocks"')) {
    return { prose: text, payloadJson: null };
  }

  const tryParse = (raw: string): string | null => {
    try {
      const parsed = deskUiPayloadSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || !parsed.data.blocks?.length) return null;
      return JSON.stringify({ blocks: parsed.data.blocks });
    } catch {
      return null;
    }
  };

  const whole = tryParse(trimmed);
  if (whole) return { prose: "", payloadJson: whole };

  const start = trimmed.lastIndexOf('{"blocks"');
  if (start < 0) return { prose: text, payloadJson: null };

  const candidate = trimmed.slice(start).trim();
  const payloadJson = tryParse(candidate);
  if (!payloadJson) return { prose: text, payloadJson: null };

  const prose = trimmed.slice(0, start).trim();
  return { prose, payloadJson };
}

export function wrapDeskUiPayloadJson(payloadJson: string): string {
  return `\`\`\`${DESK_UI_FENCE}\n${payloadJson}\n\`\`\``;
}

/** JSON desk-ui truncado por max_tokens del modelo. */
export function stripIncompleteDeskUiTail(prose: string): string {
  const idx = prose.lastIndexOf('{"blocks"');
  if (idx < 0) return prose;
  const tail = prose.slice(idx).trim();
  try {
    const parsed = deskUiPayloadSchema.safeParse(JSON.parse(tail));
    if (parsed.success) return prose;
  } catch {
    /* incomplete */
  }
  return prose.slice(0, idx).trim();
}
