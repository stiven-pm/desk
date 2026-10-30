import { describe, expect, it } from "vitest";
import {
  estimateOrgGrossMarginUsd,
  planRetailUsd,
  totalMeteredCredits,
} from "./economics";

describe("economics", () => {
  it("computes margin for growth usage", () => {
    const snap = {
      planSlug: "growth" as const,
      aiCreditsUsed: 50_000,
      setupCreditsUsed: 2_000,
      ragMeterCredits: 30_000,
      messagesCount: 5000,
    };
    expect(totalMeteredCredits(snap)).toBe(82_000);
    const m = estimateOrgGrossMarginUsd(snap, "realisticAllIn");
    expect(planRetailUsd("growth")).toBe(199);
    expect(m.mrrUsd).toBe(199);
    expect(m.variableUsd).toBeGreaterThan(0);
  });
});
