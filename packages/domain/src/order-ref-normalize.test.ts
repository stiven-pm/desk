import { describe, expect, it } from "vitest";
import {
  extractPublicOrderRefFromText,
  normalizeNativeOrderLookupFields,
  normalizePhoneDigits,
  normalizePublicOrderRef,
  normalizePublicOrderRefLoose,
  publicOrderRefsEquivalent,
  resolvePublicOrderRefForLookup,
} from "./order-ref-normalize";

describe("normalizePublicOrderRef", () => {
  it.each([
    ["RK-9051", "RK-9051"],
    ["rk5091", "RK-5091"],
    ["rk 5091", "RK-5091"],
    ["RK.5091", "RK-5091"],
    ["rk_5091", "RK-5091"],
    ["referencia 5091", "RK-5091"],
    ["pedido #5091", "RK-5091"],
    ["  rk  -  5091  ", "RK-5091"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePublicOrderRef(input)).toBe(expected);
  });

  it("no confunde teléfono largo con ref", () => {
    expect(normalizePublicOrderRef("3001234567")).toBeNull();
  });
});

describe("normalizePublicOrderRefLoose", () => {
  it("RK5091 pegado", () => {
    expect(normalizePublicOrderRefLoose("RK5091")).toBe("RK-5091");
  });
});

describe("extractPublicOrderRefFromText", () => {
  it("en frase con producto", () => {
    expect(extractPublicOrderRefFromText("rk5091 las costillas")).toBe(
      "RK-5091",
    );
  });
});

describe("normalizePhoneDigits", () => {
  it("quita prefijo 57", () => {
    expect(normalizePhoneDigits("+57 300 123 4567")).toBe("3001234567");
  });
});

describe("normalizeNativeOrderLookupFields", () => {
  it("normaliza todos los campos", () => {
    expect(
      normalizeNativeOrderLookupFields({
        publicRef: "rk.5091",
        phone: "+57 300 111 2222",
        email: " Ana@Mail.COM ",
      }),
    ).toEqual({
      publicRef: "RK-5091",
      phone: "3001112222",
      email: "ana@mail.com",
    });
  });
});

describe("resolvePublicOrderRefForLookup", () => {
  it("expone canonical y sufijo", () => {
    expect(resolvePublicOrderRefForLookup("rk-5091")).toEqual({
      canonical: "RK-5091",
      digitSuffix: "5091",
    });
  });
});

describe("publicOrderRefsEquivalent", () => {
  it("equivalencias", () => {
    expect(publicOrderRefsEquivalent("rk5091", "RK-5091")).toBe(true);
    expect(publicOrderRefsEquivalent("RK-5091", "RK-5092")).toBe(false);
  });
});
