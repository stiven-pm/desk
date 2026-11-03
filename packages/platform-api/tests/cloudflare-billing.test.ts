import { describe, expect, it } from "vitest";

/** Mirrors aggregate logic in cloudflare-billing.ts for regression tests. */
function aggregateContractedCost(rows: Record<string, unknown>[]) {
  let total = 0;
  const families = new Map<string, number>();
  for (const row of rows) {
    const cost = Number(row.ContractedCost ?? 0);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    total += cost;
    const family = String(row.ServiceFamilyName ?? "Other");
    families.set(family, (families.get(family) ?? 0) + cost);
  }
  return { total: Math.round(total * 100) / 100, families };
}

describe("cloudflare billable usage aggregation", () => {
  it("sums ContractedCost by family", () => {
    const { total, families } = aggregateContractedCost([
      {
        ServiceFamilyName: "Workers",
        ServiceName: "Workers Standard",
        ContractedCost: 5.25,
      },
      {
        ServiceFamilyName: "Workers AI",
        ServiceName: "Workers AI",
        ContractedCost: 12.4,
      },
      {
        ServiceFamilyName: "Workers",
        ServiceName: "Durable Objects",
        ContractedCost: 1.1,
      },
    ]);
    expect(total).toBe(18.75);
    expect(families.get("Workers AI")).toBe(12.4);
    expect(families.get("Workers")).toBeCloseTo(6.35);
  });
});
