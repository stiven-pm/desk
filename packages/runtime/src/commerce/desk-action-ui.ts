import { DESK_UI_FENCE } from "@chatbot/chat-ui";
import {
  internalDeskCommandToToken,
  isDeskActionToken,
  signDeskAction,
} from "@chatbot/domain";

const FENCE_RE = new RegExp(
  `\`\`\`${DESK_UI_FENCE}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
  "g",
);

/** Sustituye __desk:* en bloques choices y products por tokens firmados. */
export async function signDeskUiInAssistantText(
  text: string,
  conversationId: string,
  secret: string,
): Promise<string> {
  if (!secret.trim() || !text.includes(DESK_UI_FENCE)) return text;

  let out = text;
  const matches = [...text.matchAll(FENCE_RE)];
  for (const m of matches) {
    const rawJson = m[1];
    if (
      !rawJson?.includes('"choices"') &&
      !rawJson?.includes('"products"') &&
      !rawJson?.includes('"product_catalog"')
    ) {
      continue;
    }
    try {
      const parsed = JSON.parse(rawJson) as {
        blocks?: Array<{
          type?: string;
          items?: Array<{
            label?: string;
            message?: string;
            title?: string;
            prompt?: string;
          }>;
        }>;
      };
      if (!parsed.blocks?.length) continue;
      let changed = false;
      for (const block of parsed.blocks) {
        if (block.type === "choices" && block.items) {
          for (const item of block.items) {
            const msg = item.message?.trim();
            if (!msg || isDeskActionToken(msg)) continue;
            const token = await internalDeskCommandToToken(
              secret,
              conversationId,
              msg,
            );
            if (token) {
              item.message = token;
              changed = true;
            }
          }
        }
        if (block.type === "products" && block.items) {
          for (const item of block.items) {
            const prompt = item.prompt?.trim();
            if (!prompt || isDeskActionToken(prompt)) continue;
            const view = prompt.match(/^__desk:product:([^:]+)__$/);
            if (!view?.[1]) continue;
            item.prompt = await signDeskAction(secret, conversationId, {
              kind: "view_product",
              productId: view[1],
              title: item.title?.trim() || undefined,
            });
            changed = true;
          }
        }
        if (block.type === "product_catalog" && block.items) {
          for (const item of block.items) {
            const prompt = item.prompt?.trim();
            if (!prompt || isDeskActionToken(prompt)) continue;
            const view = prompt.match(/^__desk:product:([^:]+)__$/);
            if (!view?.[1]) continue;
            item.prompt = await signDeskAction(secret, conversationId, {
              kind: "view_product",
              productId: view[1],
              title: item.title?.trim() || undefined,
            });
            changed = true;
          }
        }
      }
      if (!changed) continue;
      const replacement = `\`\`\`${DESK_UI_FENCE}\n${JSON.stringify(parsed)}\n\`\`\``;
      out = out.replace(m[0], replacement);
    } catch {
      /* keep block */
    }
  }
  return out;
}
