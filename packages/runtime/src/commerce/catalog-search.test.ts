import { describe, expect, it } from "vitest";
import {
  buildFtsAndMatchQuery,
  buildFtsOrMatchQuery,
  resolveCommerceProductSearch,
  visitorCatalogSearchTerms,
} from "./catalog-search";

describe("visitorCatalogSearchTerms", () => {
  it("conserva términos cortos de producto", () => {
    expect(visitorCatalogSearchTerms("té")).toBe("te");
    expect(visitorCatalogSearchTerms("tv")).toBe("tv");
    expect(visitorCatalogSearchTerms("costillas")).toBe("costillas");
  });

  it("sin tokens útiles devuelve cadena vacía", () => {
    expect(visitorCatalogSearchTerms("qué venden?")).toContain("venden");
    expect(visitorCatalogSearchTerms("de la el")).toBe("");
  });

  it("conserva términos concretos en frase corta", () => {
    expect(visitorCatalogSearchTerms("pollo y papas")).toContain("pollo");
    expect(visitorCatalogSearchTerms("pollo y papas")).toContain("papas");
  });
});

describe("buildFtsMatchQuery", () => {
  it("quotes tokens for AND and OR", () => {
    expect(buildFtsAndMatchQuery(["te", "costillas"])).toBe('"te" "costillas"');
    expect(buildFtsOrMatchQuery(["te", "costillas"])).toBe('"te" OR "costillas"');
  });
});

describe("resolveCommerceProductSearch", () => {
  it("browse ignora query", () => {
    expect(
      resolveCommerceProductSearch({
        mode: "browse",
        query: "qué productos tienen",
      }),
    ).toEqual({ mode: "browse", queryForSql: "" });
  });

  it("search con términos de producto", () => {
    expect(
      resolveCommerceProductSearch({ mode: "search", query: "costillas" }),
    ).toEqual({ mode: "search", queryForSql: "costillas" });
  });

  it("search con té normalizado", () => {
    expect(
      resolveCommerceProductSearch({ mode: "search", query: "té" }),
    ).toEqual({ mode: "search", queryForSql: "te" });
  });

  it("search degrada a browse si query es frase larga", () => {
    const r = resolveCommerceProductSearch({
      mode: "search",
      query: "qué productos tienen para el almuerzo hoy",
    });
    expect(r.mode).toBe("browse");
    expect(r.degraded).toBe(true);
    expect(r.degradeReason).toBe("too_long");
  });

  it("search degrada a browse si solo gramática", () => {
    const r = resolveCommerceProductSearch({ mode: "search", query: "de la el" });
    expect(r.mode).toBe("browse");
    expect(r.degraded).toBe(true);
    expect(r.degradeReason).toBe("no_tokens");
  });

  it("sin mode válido degrada con invalid_mode", () => {
    const r = resolveCommerceProductSearch({ query: "costillas" });
    expect(r).toMatchObject({
      mode: "browse",
      degraded: true,
      degradeReason: "invalid_mode",
    });
  });
});
