import { describe, expect, it } from "vitest";
import {
  classifyVisitorTurn,
  shouldAttachCommerceTools,
  shouldInjectNativeCatalogContext,
} from "./intent-router";

describe("classifyVisitorTurn", () => {
  it("empty is small_talk for metering only", () => {
    expect(classifyVisitorTurn("")).toBe("small_talk");
    expect(classifyVisitorTurn("   ")).toBe("small_talk");
  });

  it("any other message is general (LLM + tools)", () => {
    expect(classifyVisitorTurn("Hola")).toBe("general");
    expect(classifyVisitorTurn("gracias!")).toBe("general");
    expect(classifyVisitorTurn("qué productos tienen?")).toBe("general");
  });
});

describe("shouldAttachCommerceTools", () => {
  it("activates with native catalog", () => {
    expect(
      shouldAttachCommerceTools({
        cartLineCount: 0,
        hasNativeCatalog: true,
      }),
    ).toBe(true);
  });

  it("activates with org commerce or cart", () => {
    expect(
      shouldAttachCommerceTools({ cartLineCount: 0, orgHasCommerce: true }),
    ).toBe(true);
    expect(shouldAttachCommerceTools({ cartLineCount: 1 })).toBe(true);
    expect(shouldAttachCommerceTools({ cartLineCount: 0 })).toBe(false);
  });
});

describe("shouldInjectNativeCatalogContext", () => {
  it("catálogo en contexto cuando commerce activo", () => {
    expect(shouldInjectNativeCatalogContext({ attachCommerce: true })).toBe(
      true,
    );
    expect(shouldInjectNativeCatalogContext({ attachCommerce: false })).toBe(
      false,
    );
  });
});
