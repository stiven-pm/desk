import { describe, expect, it } from "vitest";
import {
  extractWorkersAiChatText,
  extractWorkersAiToolCalls,
  parseToolCallsFromContent,
  workersAiChatRequestBody,
} from "./llm-client";

describe("workersAiChatRequestBody", () => {
  it("desactiva reasoning en DeepSeek V4", () => {
    const body = workersAiChatRequestBody(
      "@cf/deepseek-ai/deepseek-v4-flash-0731",
      { messages: [] },
    );
    expect(body.reasoning_effort).toBe("none");
  });

  it("usa reasoning bajo en GLM-5.3-Flash", () => {
    const body = workersAiChatRequestBody("@cf/zai-org/glm-5.3-flash", {
      messages: [],
    });
    expect(body.reasoning_effort).toBe("low");
  });
});

describe("extractWorkersAiChatText", () => {
  it("reads legacy response field", () => {
    expect(extractWorkersAiChatText({ response: "hola" })).toBe("hola");
  });

  it("reads OpenAI-style choices", () => {
    expect(
      extractWorkersAiChatText({
        choices: [{ message: { content: "desde choices" } }],
      }),
    ).toBe("desde choices");
  });

  it("reads nested result object", () => {
    expect(
      extractWorkersAiChatText({
        result: { choices: [{ message: { content: "anidado" } }] },
      }),
    ).toBe("anidado");
  });
});

describe("extractWorkersAiToolCalls", () => {
  const allow = new Set(["desk_visitor_message"]);

  it("reads OpenAI-style choices[].message.tool_calls", () => {
    const calls = extractWorkersAiToolCalls(
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "desk_visitor_message",
                    arguments: '{"text":"hola"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
      allow,
    );
    expect(calls).toHaveLength(1);
    expect(calls![0].name).toBe("desk_visitor_message");
    expect(JSON.parse(calls![0].arguments)).toEqual({ text: "hola" });
  });

  it("parses desk_visitor_message({...}) from assistant prose", () => {
    const calls = parseToolCallsFromContent(
      'prefix desk_visitor_message({"text": "¡De nuevo por aquí!"})',
      allow,
    );
    expect(calls).toHaveLength(1);
    expect(calls![0].name).toBe("desk_visitor_message");
    expect(JSON.parse(calls![0].arguments).text).toBe("¡De nuevo por aquí!");
  });
});
