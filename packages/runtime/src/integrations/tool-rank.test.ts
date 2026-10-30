import { describe, expect, it } from "vitest";
import type { AgentTool } from "./types";
import {
  rankToolsForUserMessage,
  shouldUseToolFastPath,
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

describe("tool-rank harness", () => {
  it("returns empty for small talk", () => {
    const tools = [httpTool("get_invoice", "Obtiene factura cliente")];
    expect(rankToolsForUserMessage(tools, "hola")).toEqual([]);
  });

  it("fast path when keyword aligns", () => {
    const tools = [
      httpTool("get_invoice", "Obtiene factura del cliente"),
      httpTool("list_products", "Lista productos catálogo"),
    ];
    const fast = shouldUseToolFastPath(tools, "necesito la factura del cliente");
    expect(fast?.map((t) => t.tool.name)).toContain("get_invoice");
  });

  it("scores many tools without sending all schemas", () => {
    const tools = Array.from({ length: 100 }, (_, i) =>
      httpTool(`tool_${i}`, `descripcion generica ${i}`),
    );
    const scored = scoreToolsForMessage(tools, "pedido producto stock");
    expect(scored.length).toBe(100);
    expect(rankToolsForUserMessage(tools, "pedido producto stock").length).toBeLessThanOrEqual(
      8,
    );
  });
});
