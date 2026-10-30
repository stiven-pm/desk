import { describe, expect, it } from "vitest";
import { validateCommerceBuyerField } from "./buyer-field-validation";

describe("validateCommerceBuyerField", () => {
  it("requires full name", () => {
    expect(validateCommerceBuyerField("name", "yeison").ok).toBe(false);
    const ok = validateCommerceBuyerField("name", "yeison garcia");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toBe("Yeison Garcia");
  });

  it("validates document digits", () => {
    expect(validateCommerceBuyerField("documentId", "abc").ok).toBe(false);
    const ok = validateCommerceBuyerField("documentId", "1.234.567");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toBe("1234567");
  });

  it("validates CO mobile", () => {
    expect(validateCommerceBuyerField("phone", "3024137751").ok).toBe(true);
    expect(validateCommerceBuyerField("phone", "123").ok).toBe(false);
  });

  it("validates address shape", () => {
    expect(validateCommerceBuyerField("address", "medellin").ok).toBe(false);
    expect(
      validateCommerceBuyerField("address", "carrera 28 #88-90").ok,
    ).toBe(true);
  });
});
