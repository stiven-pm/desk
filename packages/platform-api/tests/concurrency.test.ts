import { describe, expect, it } from "vitest";
import { creditsFromUsage } from "@chatbot/domain";

describe("usage credits", () => {
  it("weights output higher than input", () => {
    const inOnly = creditsFromUsage({ inputTokens: 1000, outputTokens: 0 });
    const outOnly = creditsFromUsage({ inputTokens: 0, outputTokens: 1000 });
    expect(outOnly).toBeGreaterThan(inOnly);
  });
});
