import { DESK_UI_FENCE } from "@chatbot/chat-ui";
import type { VisitorStateBarChoice } from "@chatbot/domain";
import { deskUiFence } from "./commerce-ui";

const FENCE_RE = new RegExp(
  `\`\`\`${DESK_UI_FENCE}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
  "g",
);

function responseHasDeskBlock(text: string, blockType: string): boolean {
  return (
    text.includes(`"type":"${blockType}"`) ||
    text.includes(`"type": "${blockType}"`)
  );
}

type DeskUiJson = {
  blocks?: Array<{
    type?: string;
    items?: VisitorStateBarChoice[];
    [key: string]: unknown;
  }>;
};

function parseAllDeskUiBlocks(text: string): {
  prose: string;
  blocks: DeskUiJson["blocks"];
} {
  const blocks: NonNullable<DeskUiJson["blocks"]> = [];
  let prose = text;
  for (const m of text.matchAll(FENCE_RE)) {
    prose = prose.replace(m[0], "");
    try {
      const parsed = JSON.parse(m[1]!) as DeskUiJson;
      if (parsed.blocks?.length) blocks.push(...parsed.blocks);
    } catch {
      /* ignore */
    }
  }
  return { prose: prose.trimEnd(), blocks };
}

const STRIP_WHEN_CHECKOUT_BUSY = new Set(["choices", "product_catalog"]);

/** Quita catálogo/botones del modelo cuando el flujo de checkout no está idle. */
export function stripModelDeskBlocksWhenCheckoutBusy(
  text: string,
  checkoutBusy: boolean,
): string {
  if (!checkoutBusy || !text.includes(DESK_UI_FENCE)) return text;
  const { prose, blocks } = parseAllDeskUiBlocks(text);
  const kept = (blocks ?? []).filter(
    (b) => !b.type || !STRIP_WHEN_CHECKOUT_BUSY.has(b.type),
  );
  if (!kept.length) return prose.trimEnd();
  return `${prose.trimEnd()}${deskUiFence(kept)}`;
}

/** Fusiona bloques `choices` de todos los fences y añade ítems nuevos en un solo fence al final. */
export function consolidateDeskUiFences(
  text: string,
  extraChoices: VisitorStateBarChoice[] = [],
): string {
  const hasFence = text.includes(DESK_UI_FENCE);
  if (!hasFence && !extraChoices.length) return text;

  const { prose, blocks: rawBlocks } = parseAllDeskUiBlocks(text);
  const nonChoice: NonNullable<DeskUiJson["blocks"]> = [];
  const mergedItems: VisitorStateBarChoice[] = [];
  const seen = new Set<string>();

  for (const block of rawBlocks ?? []) {
    if (block.type === "choices" && block.items?.length) {
      for (const item of block.items) {
        const key = item.message.trim();
        if (seen.has(key)) continue;
        seen.add(key);
        mergedItems.push(item);
      }
    } else {
      nonChoice.push(block);
    }
  }

  for (const item of extraChoices) {
    const key = item.message.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    mergedItems.push(item);
  }

  const outBlocks: NonNullable<DeskUiJson["blocks"]> = [...nonChoice];
  if (mergedItems.length) {
    outBlocks.push({ type: "choices", items: mergedItems });
  }

  if (!outBlocks.length) return prose.trimEnd();
  return `${prose.trimEnd()}${deskUiFence(outBlocks)}`;
}

/** Añade o fusiona bloque choices con la barra de estado del visitante. */
export function appendVisitorStateBarDeskUi(
  text: string,
  items: VisitorStateBarChoice[],
): string {
  if (
    !items.length &&
    !text.includes(DESK_UI_FENCE) &&
    !responseHasDeskBlock(text, "choices")
  ) {
    return text;
  }
  if (
    responseHasDeskBlock(text, "choices") &&
    !text.includes(DESK_UI_FENCE)
  ) {
    return text;
  }

  return consolidateDeskUiFences(text, items);
}

export function assistantResponseHasChoices(text: string): boolean {
  return responseHasDeskBlock(text, "choices");
}

export function assistantResponseHasProductCatalog(text: string): boolean {
  return responseHasDeskBlock(text, "product_catalog");
}
