import { describe, expect, it } from "vitest";
import { formatPublicOrderRef } from "./order-ref";

describe("formatPublicOrderRef", () => {
  it("generates RK- prefix with digits", () => {
    const ref = formatPublicOrderRef();
    expect(ref).toMatch(/^RK-\d{4}$/);
  });
});
