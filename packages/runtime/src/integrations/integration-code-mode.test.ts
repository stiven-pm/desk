import { describe, expect, it } from "vitest";
import type { AgentTool } from "./types";
import {
  buildIntegrationApiReference,
  runDeskCodemode,
} from "./integration-code-mode";

describe("integration-code-mode", () => {
  it("builds API reference lines", () => {
    const tools: AgentTool[] = [
      {
        kind: "http",
        tool: {
          id: "1",
          name: "get_invoice",
          description: "Fetch invoice by number",
          method: "GET",
          path: "/inv",
          parameters: [
            { name: "invoiceId", in: "query", required: true },
          ],
          baseUrl: "https://example.com",
          authType: "none",
        },
      },
    ];
    const ref = buildIntegrationApiReference(tools);
    expect(ref).toContain("get_invoice");
    expect(ref).toContain("invoiceId");
  });

  it("runs desk.search in sandbox", async () => {
    const tools: AgentTool[] = [
      {
        kind: "http",
        tool: {
          id: "1",
          name: "order_status",
          description: "Order status lookup",
          method: "GET",
          path: "/o",
          parameters: [],
          baseUrl: "https://example.com",
          authType: "none",
        },
      },
    ];
    const toolIndex = new Map(tools.map((t) => [t.tool.name, t]));
    const out = await runDeskCodemode({
      code: "return await desk.search('order');",
      allTools: tools,
      toolIndex,
    });
    const parsed = JSON.parse(out) as { ok: boolean; result: { tools: unknown[] } };
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.result.tools)).toBe(true);
  });
});
