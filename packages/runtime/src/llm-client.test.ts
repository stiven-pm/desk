import { describe, expect, it } from "vitest";
import {
  extractWorkersAiChatText,
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
