import {
  splitTrailingDeskUiJson,
  stripIncompleteDeskUiTail,
  wrapDeskUiPayloadJson,
} from "./coerce-desk-ui";
import { sanitizeDeskHtml } from "./sanitize-html";
import { deskUiPayloadSchema } from "./schema";
import { DESK_UI_FENCE, type DeskUiBlock } from "./types";

const FENCE_RE = new RegExp(
  "```" + DESK_UI_FENCE + "\\s*([\\s\\S]*?)```",
  "gi",
);

export type ValidateDeskUiOptions = {
  allowedHostComponents?: string[];
};

function filterHostBlocks(
  blocks: DeskUiBlock[],
  allowed?: string[],
): DeskUiBlock[] {
  return blocks.filter((b) => {
    if (b.type !== "host") return true;
    if (!allowed?.length) return false;
    return allowed.includes(b.component);
  });
}

function normalizeValidated(blocks: DeskUiBlock[]): DeskUiBlock[] {
  return blocks.map((b) => {
    if (b.type === "html") {
      return { type: "html", html: sanitizeDeskHtml(b.html, 6000) };
    }
    return b;
  });
}

/** Valida bloques desk-ui y reconstruye el mensaje (quita JSON inválido o host no permitido). */
export function validateAssistantMessage(
  text: string,
  opts?: ValidateDeskUiOptions,
): string {
  const fences: string[] = [];
  let prose = text;
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(text)) !== null) {
    prose = prose.replace(m[0], "").trim();
    try {
      const raw = JSON.parse(m[1].trim()) as unknown;
      const parsed = deskUiPayloadSchema.safeParse(raw);
      if (!parsed.success) continue;
      const rawBlocks = (parsed.data.blocks ?? []) as DeskUiBlock[];
      const blocks = filterHostBlocks(
        normalizeValidated(rawBlocks),
        opts?.allowedHostComponents,
      );
      if (!blocks.length) continue;
      fences.push(
        `\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({ blocks })}\n\`\`\``,
      );
    } catch {
      continue;
    }
  }
  let finalProse = prose.trim();
  const bare = splitTrailingDeskUiJson(finalProse);
  if (bare.payloadJson) {
    try {
      const raw = JSON.parse(bare.payloadJson) as unknown;
      const parsed = deskUiPayloadSchema.safeParse(raw);
      if (parsed.success) {
        const rawBlocks = (parsed.data.blocks ?? []) as DeskUiBlock[];
        const blocks = filterHostBlocks(
          normalizeValidated(rawBlocks),
          opts?.allowedHostComponents,
        );
        if (blocks.length) {
          fences.push(wrapDeskUiPayloadJson(JSON.stringify({ blocks })));
          finalProse = bare.prose;
        }
      }
    } catch {
      /* keep prose */
    }
  }

  const cleaned = stripIncompleteDeskUiTail(finalProse);
  const body = [cleaned, ...fences].filter(Boolean).join("\n\n");
  return body || text.trim();
}
