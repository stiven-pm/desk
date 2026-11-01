import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../llm-client", () => ({
  llmChatWithMessages: vi.fn(),
  llmChatWithMessagesStream: vi.fn(),
  llmStreamingEnabled: vi.fn(() => false),
}));

import { llmChatWithMessages } from "../llm-client";
import { agentLlmTurn } from "./agent-llm-turn";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "commerce_search_products",
      description: "search",
      parameters: { type: "object", properties: {} },
    },
  },
];

describe("agentLlmTurn", () => {
  beforeEach(() => {
    vi.mocked(llmChatWithMessages).mockReset();
  });

  it("retries with tools and thread hint when earlier attempts are empty", async () => {
    vi.mocked(llmChatWithMessages)
      .mockResolvedValueOnce({ ok: false, reason: "empty_response" })
      .mockResolvedValueOnce({ ok: false, reason: "empty_response" })
      .mockResolvedValueOnce({
        ok: true,
        content: "",
        promptTokens: 1,
        completionTokens: 1,
        toolCalls: [{ id: "1", name: "commerce_search_products", arguments: "{}" }],
      });

    const result = await agentLlmTurn({} as import("../llm-client").LlmEnv, {
      messages: [{ role: "user", content: "hola" }],
      tools,
      allowStream: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.toolCalls?.[0]?.name).toBe("commerce_search_products");
    }
    expect(llmChatWithMessages).toHaveBeenCalledTimes(3);
  });

  it("does not accept prose-only on step 1 when tools are attached", async () => {
    vi.mocked(llmChatWithMessages)
      .mockResolvedValueOnce({
        ok: true,
        content: "Hola, ¿en qué te ayudo?",
        promptTokens: 1,
        completionTokens: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        content: "",
        promptTokens: 1,
        completionTokens: 1,
        toolCalls: [{ id: "1", name: "commerce_search_products", arguments: "{}" }],
      });

    const result = await agentLlmTurn({} as import("../llm-client").LlmEnv, {
      messages: [{ role: "user", content: "hola" }],
      tools,
      allowStream: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.toolCalls?.[0]?.name).toBe("commerce_search_products");
    }
    expect(llmChatWithMessages).toHaveBeenCalledTimes(2);
  });

  it("returns degraded prose on ladder step 4 when tools never called", async () => {
    vi.mocked(llmChatWithMessages)
      .mockResolvedValueOnce({
        ok: true,
        content: "solo prosa",
        promptTokens: 1,
        completionTokens: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        content: "solo prosa",
        promptTokens: 1,
        completionTokens: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        content: "solo prosa",
        promptTokens: 1,
        completionTokens: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        content: "respuesta degradada",
        promptTokens: 1,
        completionTokens: 1,
      });

    const result = await agentLlmTurn({} as import("../llm-client").LlmEnv, {
      messages: [{ role: "user", content: "hola" }],
      tools,
      allowStream: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.degraded).toBe(true);
      expect(result.content).toBe("respuesta degradada");
    }
    expect(llmChatWithMessages).toHaveBeenCalledTimes(4);
    expect(vi.mocked(llmChatWithMessages).mock.calls[3][1]?.tools).toBeUndefined();
  });

  it("returns first usable tool response without degraded flag", async () => {
    vi.mocked(llmChatWithMessages).mockResolvedValueOnce({
      ok: true,
      content: "",
      promptTokens: 1,
      completionTokens: 1,
      toolCalls: [{ id: "1", name: "commerce_search_products", arguments: "{}" }],
    });

    const result = await agentLlmTurn({} as import("../llm-client").LlmEnv, {
      messages: [{ role: "user", content: "productos" }],
      tools,
      allowStream: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.toolCalls?.[0]?.name).toBe("commerce_search_products");
      expect(result.degraded).toBeUndefined();
    }
    expect(llmChatWithMessages).toHaveBeenCalledTimes(1);
  });
});
