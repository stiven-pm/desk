import { describe, expect, it } from "vitest";
import { createPendingPrompt, DESK_CMD_MENU } from "@chatbot/domain";
import {
  parsePendingPromptClassifierVerdict,
  classifyPendingPromptReply,
} from "./pending-prompt-classifier";
import {
  PENDING_PROMPT_CLASSIFIER_FIXTURES,
  PENDING_PROMPT_CLASSIFIER_MIN_ACCURACY,
} from "./pending-prompt-classifier-fixtures";

describe("parsePendingPromptClassifierVerdict", () => {
  it("parses first word verdict", () => {
    expect(parsePendingPromptClassifierVerdict("accept")).toBe("accept");
    expect(parsePendingPromptClassifierVerdict("Decline.")).toBe("decline");
    expect(parsePendingPromptClassifierVerdict("other\n")).toBe("other");
  });

  it("returns other for garbage", () => {
    expect(parsePendingPromptClassifierVerdict("maybe")).toBe("other");
    expect(parsePendingPromptClassifierVerdict("")).toBe("other");
  });
});

describe("classifyPendingPromptReply (LLM eval)", () => {
  const runEval = process.env.DESK_PENDING_CLASSIFIER_EVAL === "1";

  it.skipIf(!runEval)(
    "fixtures meet minimum accuracy against Workers AI",
    async () => {
      const env = {
        WORKERS_AI_MODEL:
          process.env.WORKERS_AI_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
        AI: undefined as unknown,
      };
      let ok = 0;
      const failures: string[] = [];
      for (const f of PENDING_PROMPT_CLASSIFIER_FIXTURES) {
        const pending = createPendingPrompt({
          action: DESK_CMD_MENU,
          offerSummary: f.offerSummary,
        });
        const verdict = await classifyPendingPromptReply(
          env,
          pending,
          f.userMessage,
        );
        if (verdict === f.expected) ok += 1;
        else failures.push(`${f.id}: got ${verdict}, want ${f.expected}`);
      }
      const accuracy = ok / PENDING_PROMPT_CLASSIFIER_FIXTURES.length;
      if (failures.length) {
        console.error(failures.slice(0, 15).join("\n"));
      }
      expect(accuracy).toBeGreaterThanOrEqual(
        PENDING_PROMPT_CLASSIFIER_MIN_ACCURACY,
      );
    },
    120_000,
  );
});

describe("pending prompt classifier fixtures", () => {
  it("has balanced coverage", () => {
    const counts = { accept: 0, decline: 0, other: 0 };
    for (const f of PENDING_PROMPT_CLASSIFIER_FIXTURES) {
      counts[f.expected] += 1;
    }
    expect(PENDING_PROMPT_CLASSIFIER_FIXTURES.length).toBeGreaterThanOrEqual(40);
    expect(counts.other).toBeGreaterThanOrEqual(15);
    expect(counts.accept).toBeGreaterThanOrEqual(10);
    expect(counts.decline).toBeGreaterThanOrEqual(6);
  });
});
