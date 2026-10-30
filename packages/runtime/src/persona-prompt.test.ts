import { describe, expect, it } from "vitest";
import { buildDeskSystemPrompt } from "./persona-prompt";

describe("buildDeskSystemPrompt", () => {
  it("distingue precio informativo vs carrito", () => {
    const prompt = buildDeskSystemPrompt({
      companyInstructions: "Vendemos ropa.",
      hasCommerce: true,
    });
    expect(prompt).toContain("Grafo de venta");
    expect(prompt).toContain("uses cifras del contexto documental");
    expect(prompt).toContain("No inventes");
    expect(prompt).toContain("priceCents");
  });

  it("menciona herramientas de catálogo cuando hasTools", () => {
    const prompt = buildDeskSystemPrompt({
      companyInstructions: "",
      hasTools: true,
    });
    expect(prompt).toContain("Herramientas conectadas");
  });
});
