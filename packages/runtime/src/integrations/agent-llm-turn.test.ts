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

  it("with requireTools retries with tools only, not without tools", async () => {
    vi.mocked(llmChatWithMessages)
      .mockResolvedValueOnce({ ok: false, reason: "http_error" })
      .mockResolvedValueOnce({
        ok: true,
        content: "ok",
        promptTokens: 1,
        completionTokens: 1,
      });

    await agentLlmTurn({} as import("../llm-client").LlmEnv, {
      messages: [{ role: "user", content: "hola" }],
      tools,
      allowStream: false,
      requireTools: true,
    });

    expect(llmChatWithMessages).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(llmChatWithMessages).mock.calls) {
      expect(call[1]?.tools).toEqual(tools);
    }
  });

  it("without requireTools may retry without tools", async () => {
    vi.mocked(llmChatWithMessages)
      .mockResolvedValueOnce({ ok: false, reason: "http_error" })
      .mockResolvedValueOnce({
        ok: true,
        content: "prosa",
        promptTokens: 1,
        completionTokens: 1,
      });

    await agentLlmTurn({} as import("../llm-client").LlmEnv, {
      messages: [{ role: "user", content: "hola" }],
      tools,
      allowStream: false,
      requireTools: false,
    });

    expect(llmChatWithMessages).toHaveBeenCalledTimes(2);
    expect(vi.mocked(llmChatWithMessages).mock.calls[1][1]?.tools).toBeUndefined();
  });
});
