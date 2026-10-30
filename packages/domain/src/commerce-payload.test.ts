import { describe, expect, it } from "vitest";
import { normalizeCommercePayload } from "./commerce-payload";

describe("normalizeCommercePayload", () => {
  it("allows primitives when no allowlist", () => {
    const r = normalizeCommercePayload({ sku: "A1", qty: 2 }, null);
    expect(r).toEqual({ ok: true, payload: { sku: "A1", qty: 2 } });
  });

  it("rejects keys outside allowlist", () => {
    const r = normalizeCommercePayload(
      { sku: "A1", secret: "x" },
      ["sku", "qty"],
    );
    expect(r).toEqual({ ok: false, code: "payload_key_not_allowed" });
  });

  it("rejects functions and deep nesting", () => {
    expect(
      normalizeCommercePayload({ fn: () => 1 } as Record<string, unknown>, null),
    ).toEqual({ ok: false, code: "payload_invalid_value" });
  });
});
