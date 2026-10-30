import { describe, expect, it } from "vitest";
import { visitorCatalogSearchTerms } from "./catalog-search";

describe("visitorCatalogSearchTerms", () => {
  it("sin tokens útiles devuelve cadena vacía", () => {
    expect(visitorCatalogSearchTerms("qué venden?")).toBe("");
    expect(visitorCatalogSearchTerms("Menú")).toBe("");
  });

  it("conserva términos concretos", () => {
    expect(visitorCatalogSearchTerms("algo con pollo y papas")).toContain("pollo");
    expect(visitorCatalogSearchTerms("algo con pollo y papas")).toContain("papas");
  });

  it("ignora stopwords genéricos", () => {
    const t = visitorCatalogSearchTerms("busco regalo corporativo");
    expect(t).toContain("regalo");
    expect(t).toContain("corporativo");
    expect(t).not.toMatch(/\bbusco\b/);
  });
});
