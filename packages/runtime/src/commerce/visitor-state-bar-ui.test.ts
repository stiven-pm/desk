import { DESK_UI_FENCE, parseAssistantUi } from "@chatbot/chat-ui";
import { DESK_CMD_MENU, DESK_CMD_PAY } from "@chatbot/domain";
import { describe, expect, it } from "vitest";
import {
  appendVisitorStateBarDeskUi,
  consolidateDeskUiFences,
} from "./visitor-state-bar-ui";
import { deskUiFence } from "./commerce-ui";

describe("consolidateDeskUiFences", () => {
  it("fusiona choices de varios fences en uno", () => {
    const cartFence = deskUiFence([
      { type: "cart", currency: "COP", lines: [{ name: "X", quantity: 1, unitPrice: 1 }] },
    ]);
    const choicesFence = deskUiFence([
      {
        type: "choices",
        items: [{ label: "Pagar", message: DESK_CMD_PAY }],
      },
    ]);
    const text = `Listo.${cartFence}${choicesFence}`;
    const out = consolidateDeskUiFences(text, [
      { label: "Menú", message: DESK_CMD_MENU },
    ]);
    const fenceMatches = [...out.matchAll(new RegExp(`\`\`\`${DESK_UI_FENCE}`, "g"))];
    expect(fenceMatches.length).toBe(1);
    const parsed = parseAssistantUi(out);
    const choiceBlocks = parsed.blocks.filter((b) => b.type === "choices");
    expect(choiceBlocks.length).toBe(1);
    const messages = choiceBlocks[0]?.type === "choices"
      ? choiceBlocks[0].items.map((i) => i.message)
      : [];
    expect(messages).toContain(DESK_CMD_PAY);
    expect(messages).toContain(DESK_CMD_MENU);
    expect(parsed.blocks.some((b) => b.type === "cart")).toBe(true);
  });
});

describe("appendVisitorStateBarDeskUi", () => {
  it("no añade un segundo fence cuando el primero solo tiene cart", () => {
    const cartFence = deskUiFence([
      { type: "cart", currency: "COP", lines: [{ name: "X", quantity: 1, unitPrice: 1 }] },
    ]);
    const text = `Ok.${cartFence}`;
    const out = appendVisitorStateBarDeskUi(text, [
      { label: "Pagar", message: DESK_CMD_PAY },
    ]);
    expect([...out.matchAll(new RegExp(`\`\`\`${DESK_UI_FENCE}`, "g"))].length).toBe(1);
  });
});
