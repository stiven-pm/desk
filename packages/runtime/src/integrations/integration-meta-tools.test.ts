import { describe, expect, it } from "vitest";
import {
  runDeskSearchIntegrations,
  shouldOfferDeskIntegrationMetaTools,
} from "./integration-meta-tools";
import type { AgentTool } from "./types";

const httpTool = (name: string, description: string): AgentTool => ({
  kind: "http",
  tool: {
    id: name,
    name,
    description,
    method: "GET",
    path: "/x",
    parameters: [],
    baseUrl: "https://example.com",
    authType: "none",
  },
});

describe("integration-meta-tools", () => {
  it("offers meta when catalog is larger than ranked slice", () => {
    const tools = [
      httpTool("get_invoice", "Consulta factura cliente"),
      httpTool("get_stock", "Inventario almacén"),
      httpTool("get_orders", "Pedidos pendientes"),
      httpTool("get_shipments", "Envíos tracking"),
    ];
    expect(shouldOfferDeskIntegrationMetaTools(tools, 0)).toBe(true);
    expect(shouldOfferDeskIntegrationMetaTools(tools, tools.length)).toBe(
      false,
    );
  });

  it("search uses LLM-provided query tokens, not visitor regex", () => {
    const tools = [
      httpTool("erp_get_invoice", "Factura por número"),
      httpTool("erp_list_stock", "Stock producto"),
    ];
    const out = JSON.parse(
      runDeskSearchIntegrations(tools, { query: "factura número" }),
    ) as { ok: boolean; tools: { name: string }[] };
    expect(out.ok).toBe(true);
    expect(out.tools.some((t) => t.name === "erp_get_invoice")).toBe(true);
  });
});
