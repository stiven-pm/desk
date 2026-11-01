import { describe, expect, it } from "vitest";
import { agentChatTurnsForLlm, stripDeskUiBlocksForLlm } from "./visitor-chat-history";

describe("visitor-chat-history", () => {
  it("strips desk-ui fences from assistant text", () => {
    const raw = "Hola\n```desk-ui\n{\"blocks\":[]}\n```\nGracias";
    expect(stripDeskUiBlocksForLlm(raw)).toBe("Hola\n\nGracias");
  });

  it("caps and cleans agent turns", () => {
    const out = agentChatTurnsForLlm([
      { role: "user", content: "  pedido  " },
      {
        role: "assistant",
        content: "Ok\n```desk-ui\n{}\n```",
      },
    ]);
    expect(out[0].content).toBe("pedido");
    expect(out[1].content).toBe("Ok");
  });
});
