import { describe, expect, it } from "vitest";
import type { AgentTool } from "./types";
import {
  MAX_HTTP_TOOLS_PER_TURN,
  rankToolsForUserMessage,
  scoreToolsForMessage,
} from "./tool-rank";

function httpTool(name: string, desc: string): AgentTool {
  return {
    kind: "http",
    tool: {
      id: name,
      name,
      description: desc,
      method: "GET",
      path: "/x",
      parameters: [],
      baseUrl: "https://api.example.com",
      authType: "none",
    },
  };
}

describe("tool-rank", () => {
  it("returns empty when message shares no tokens with tools", () => {
    const tools = [httpTool("get_invoice", "Obtiene factura cliente")];
    expect(rankToolsForUserMessage(tools, "hola")).toEqual([]);
    expect(rankToolsForUserMessage(tools, "we")).toEqual([]);
  });

  it("ranks invoice tool when message aligns", () => {
    const tools = [
      httpTool("get_invoice", "Obtiene factura del cliente"),
      httpTool("list_products", "Lista productos catálogo"),
    ];
    const ranked = rankToolsForUserMessage(tools, "necesito la factura del cliente");
    expect(ranked.map((t) => t.tool.name)).toContain("get_invoice");
  });

  it("caps HTTP tools per turn", () => {
    const tools = Array.from({ length: 100 }, (_, i) =>
      httpTool(`tool_${i}`, `descripcion generica ${i}`),
    );
    const scored = scoreToolsForMessage(tools, "pedido producto stock");
    expect(scored.length).toBe(100);
    expect(rankToolsForUserMessage(tools, "pedido producto stock").length).toBeLessThanOrEqual(
      MAX_HTTP_TOOLS_PER_TURN,
    );
  });
});
