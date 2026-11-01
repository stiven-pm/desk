import { describe, expect, it } from "vitest";
import { rankToolsForUserMessage } from "../src/integrations/tool-rank";
import type { AgentTool } from "../src/integrations/types";

const httpTool = (name: string, description: string): AgentTool => ({
  kind: "http",
  tool: {
    name,
    description,
    method: "GET",
    url: "https://example.com",
    parameters: [],
  },
});

const FIXTURES: Array<{
  id: string;
  userMessage: string;
  tools: AgentTool[];
  expectRanked: number;
}> = [
  { id: "hola", userMessage: "hola", tools: [httpTool("list_orders", "orders")], expectRanked: 0 },
  { id: "gracias", userMessage: "gracias!", tools: [httpTool("list_orders", "orders")], expectRanked: 0 },
  { id: "si porfa", userMessage: "si porfa", tools: [httpTool("list_orders", "orders")], expectRanked: 0 },
  { id: "carrito", userMessage: "carrito", tools: [httpTool("get_cart", "cart order")], expectRanked: 0 },
  { id: "fallo", userMessage: "falló", tools: [httpTool("payment_status", "payment invoice")], expectRanked: 0 },
  { id: "productos", userMessage: "muestrame los productos", tools: [httpTool("search_products", "catalog product search")], expectRanked: 0 },
  { id: "pedido", userMessage: "estado de mi pedido", tools: [httpTool("get_order", "order pedido cliente")], expectRanked: 1 },
  { id: "stock", userMessage: "hay stock del producto", tools: [httpTool("inventory", "stock product catalog")], expectRanked: 1 },
  { id: "factura", userMessage: "necesito la factura", tools: [httpTool("get_invoice", "invoice factura cliente")], expectRanked: 1 },
  { id: "ticket", userMessage: "abrir ticket soporte", tools: [httpTool("create_ticket", "ticket soporte")], expectRanked: 1 },
  { id: "cliente", userMessage: "datos del cliente", tools: [httpTool("find_customer", "cliente customer crm")], expectRanked: 1 },
  { id: "multi", userMessage: "buscar producto en catálogo", tools: [httpTool("search_items", "product catalog item list")], expectRanked: 0 },
  { id: "no signal", userMessage: "ok entiendo", tools: [httpTool("obscure_api", "zzzz only")], expectRanked: 0 },
  { id: "cap five", userMessage: "pedido producto stock precio cliente factura", tools: Array.from({ length: 8 }, (_, i) => httpTool(`tool_${i}`, "product order stock")), expectRanked: 5 },
  { id: "browse", userMessage: "qué venden", tools: [httpTool("list_catalog", "catalog product browse")], expectRanked: 0 },
];

describe("agent turn fixtures (tool policy)", () => {
  for (const fx of FIXTURES) {
    it(fx.id, () => {
      const ranked = rankToolsForUserMessage(fx.tools, fx.userMessage);
      expect(ranked.length).toBe(fx.expectRanked);
    });
  }
});
