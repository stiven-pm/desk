import { describe, expect, it } from "vitest";
import {
  estimateOrgGrossMarginUsd,
  estimatePlanStressMarginUsd,
  PLAN_STRESS_MARGINS,
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

  it("plan stress margins stay positive for all plans", () => {
    for (const slug of ["starter", "growth", "business"] as const) {
      const s = PLAN_STRESS_MARGINS[slug];
      expect(s.grossUsd).toBeGreaterThan(0);
      expect(estimatePlanStressMarginUsd(slug).grossUsd).toBe(s.grossUsd);
    }
    expect(PLAN_STRESS_MARGINS.business.grossUsd).toBeGreaterThan(
      PLAN_STRESS_MARGINS.starter.grossUsd,
    );
  });
});
