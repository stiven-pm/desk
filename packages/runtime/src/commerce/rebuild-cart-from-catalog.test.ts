import { describe, expect, it } from "vitest";
import {
  cartFingerprint,
  sanitizeLineNotes,
} from "./rebuild-cart-from-catalog";
import type { CommerceCart } from "@chatbot/domain";

describe("sanitizeLineNotes", () => {
  it("strips control chars and caps length", () => {
    expect(sanitizeLineNotes("  salsa extra  ")).toBe("salsa extra");
    expect(sanitizeLineNotes("a\u0001b")?.length).toBeLessThanOrEqual(400);
  });
});

describe("cartFingerprint", () => {
  it("changes when quantity changes", () => {
    const a: CommerceCart = {
      currency: "COP",
      updatedAt: "",
      lines: [
        {
          productId: "p1",
          name: "X",
          priceCents: 100,
          currency: "COP",
          quantity: 1,
        },
      ],
    };
    const b: CommerceCart = {
      ...a,
      lines: [{ ...a.lines[0]!, quantity: 2 }],
    };
    expect(cartFingerprint(a)).not.toBe(cartFingerprint(b));
  });
});
