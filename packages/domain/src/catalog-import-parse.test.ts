import { describe, expect, it } from "vitest";
import { parseCatalogLinesFromText } from "./catalog-import-parse";

describe("parseCatalogLinesFromText", () => {
  it("extracts name and COP-style prices", () => {
    const text = `
Camiseta básica — $45.000
Pantalón jean 120.000 COP
Sin precio aquí
`;
    const draft = parseCatalogLinesFromText(text, { currency: "COP" });
    expect(draft.items.length).toBeGreaterThanOrEqual(2);
    expect(draft.items[0].name).toContain("Camiseta");
  });
});
