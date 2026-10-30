import { describe, expect, it } from "vitest";
import {
  classifyVisitorTurn,
  shouldAttachCommerceTools,
  shouldInjectNativeCatalogContext,
} from "./intent-router";

describe("classifyVisitorTurn", () => {
  it("detects small talk", () => {
    expect(classifyVisitorTurn("Hola")).toBe("small_talk");
    expect(classifyVisitorTurn("gracias!")).toBe("small_talk");
  });

  it("treats other messages as general", () => {
    expect(classifyVisitorTurn("qué productos tienen?")).toBe("general");
    expect(classifyVisitorTurn("Menú")).toBe("general");
    expect(classifyVisitorTurn("quiero comprar algo")).toBe("general");
    expect(classifyVisitorTurn("cuál es la política de devoluciones?")).toBe(
      "general",
    );
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
