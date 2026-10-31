import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CommerceService } from "../commerce/commerce-service";

const { agentLlmTurn } = vi.hoisted(() => ({
  agentLlmTurn: vi.fn(),
}));

vi.mock("./agent-llm-turn", () => ({
  agentLlmTurn,
}));

vi.mock("./load-tools", () => ({
  loadBotAgentTools: vi.fn(async () => []),
}));

import { runAgentWithTools } from "./agent";

function mockCommerceService(): CommerceService {
  return {
    searchProducts: vi.fn(async () => ({
      products: [
        {
          id: "snack-1",
          name: "Papas clásicas",
          description: null,
          price_cents: 3500,
          compare_at_price_cents: null,
          promo_label: null,
          currency: "COP",
          image_url: null,
          stock_qty: 10,
          allows_additions: 0,
          category: null,
          featured: 0,
        },
      ],
    })),
  } as unknown as CommerceService;
}

describe("runAgentWithTools commerce catalog UI", () => {
  beforeEach(() => {
    agentLlmTurn.mockReset();
    agentLlmTurn.mockResolvedValue({
      ok: true,
      content: "Déjame mostrarte lo que tenemos disponible hoy.",
      promptTokens: 12,
      completionTokens: 8,
    });
  });

  it("adjunta product_catalog cuando el LLM responde solo en prosa", async () => {
    const commerceService = mockCommerceService();
    const env = {
      DB: {} as D1Database,
      WORKERS_AI_MODEL: "@cf/meta/llama",
    };

    const result = await runAgentWithTools(env, {
      botId: "bot-1",
      system: "Eres ventas.",
      user: "qué productos hay?",
      ragContext: "",
      commerceService,
    });

    expect(result.text).toContain("product_catalog");
    expect(result.text).toContain("Ver productos");
    expect(commerceService.searchProducts).toHaveBeenCalled();
  });

  it("mensaje honesto si el LLM falla por http_error (sin catálogo inventado)", async () => {
    agentLlmTurn.mockResolvedValue({ ok: false, reason: "http_error" });
    const commerceService = mockCommerceService();
    const env = {
      DB: {} as D1Database,
      WORKERS_AI_MODEL: "@cf/meta/llama",
    };

    const result = await runAgentWithTools(env, {
      botId: "bot-1",
      system: "Eres ventas.",
      user: "que hay?",
      ragContext: "",
      commerceService,
    });

    expect(result.text).toContain("problema técnico");
    expect(result.text).not.toContain("product_catalog");
  });

  it("no ejecuta search fallback en saludo puro", async () => {
    const commerceService = mockCommerceService();
    const env = {
      DB: {} as D1Database,
      WORKERS_AI_MODEL: "@cf/meta/llama",
    };

    const result = await runAgentWithTools(env, {
      botId: "bot-1",
      system: "Eres ventas.",
      user: "hola",
      ragContext: "",
      commerceService,
    });

    expect(result.text).not.toContain("product_catalog");
    expect(commerceService.searchProducts).not.toHaveBeenCalled();
  });
});
