import {
  splitTrailingDeskUiJson,
  stripIncompleteDeskUiTail,
} from "./coerce-desk-ui";
import { sanitizeDeskHtml } from "./sanitize-html";
import {
  DESK_UI_FENCE,
  type DeskUiBlock,
  type DeskUiPayload,
  type ParsedAssistantUi,
  MAX_HTML_CHARS,
  MAX_UI_BLOCKS,
} from "./types";

const FENCE_RE = new RegExp(
  `\`\`\`${DESK_UI_FENCE}\\s*([\\s\\S]*?)\`\`\``,
  "gi",
);

function normalizeBlocks(payload: DeskUiPayload): DeskUiBlock[] {
  const blocks: DeskUiBlock[] = [];
  for (const b of payload.blocks ?? []) {
    if (b.type === "html" && b.html) {
      blocks.push({ type: "html", html: sanitizeDeskHtml(b.html, MAX_HTML_CHARS) });
    } else if (b.type === "external_link" && b.href && b.label) {
      const href = String(b.href).trim();
      const label = String(b.label).trim().slice(0, 80);
      if (href.startsWith("https://") && label) {
        blocks.push({ type: "external_link", href, label });
      }
    } else if (b.type === "host" && b.component) {
      blocks.push({
        type: "host",
        component: String(b.component).slice(0, 64),
        props: b.props ?? {},
      });
    } else if (b.type === "offers" && b.items?.length) {
      blocks.push({ type: "offers", items: b.items.slice(0, 6) });
    } else if (b.type === "products" && b.items?.length) {
      blocks.push({ type: "products", items: b.items.slice(0, 6) });
    } else if (b.type === "product_catalog" && b.items?.length) {
      blocks.push({
        type: "product_catalog",
        buttonLabel: String(b.buttonLabel ?? "Ver productos").slice(0, 80),
        items: b.items.slice(0, 24),
      });
    } else if (b.type === "cart" && b.lines?.length) {
      blocks.push({
        type: "cart",
        currency: String(b.currency ?? "USD").slice(0, 8),
        lines: b.lines.slice(0, 32),
      });
    } else if (b.type === "quantity" && b.productId) {
      const min = Math.min(99, Math.max(1, Number(b.min ?? 1)));
      const max = Math.min(99, Math.max(min, Number(b.max ?? 99)));
      blocks.push({
        type: "quantity",
        productId: String(b.productId).slice(0, 64),
        min,
        max,
      });
    } else if (b.type === "choices" && b.items?.length) {
      blocks.push({ type: "choices", items: b.items.slice(0, 4) });
    } else if (b.type === "gen" && b.root) {
      blocks.push({ type: "gen", root: b.root });
    }
  }
  return blocks.slice(0, MAX_UI_BLOCKS);
}

/** Extrae prosa + hasta varios bloques desk-ui en un mismo mensaje. */
export function parseAssistantUi(text: string): ParsedAssistantUi {
  const blocks: DeskUiBlock[] = [];
  let prose = text;
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(text)) !== null) {
    prose = prose.replace(m[0], "").trim();
    try {
      const payload = JSON.parse(m[1].trim()) as DeskUiPayload;
      blocks.push(...normalizeBlocks(payload));
    } catch {
      /* ignore malformed fence */
    }
  }

  const bare = splitTrailingDeskUiJson(prose);
  if (bare.payloadJson) {
    try {
      const payload = JSON.parse(bare.payloadJson) as DeskUiPayload;
      blocks.push(...normalizeBlocks(payload));
      prose = bare.prose;
    } catch {
      /* ignore */
    }
  }

  return {
    prose: stripIncompleteDeskUiTail(prose.trim()),
    blocks: blocks.slice(0, MAX_UI_BLOCKS),
  };
}
