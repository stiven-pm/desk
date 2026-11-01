import { describe, expect, it } from "vitest";
import { buildDeskSystemPrompt } from "./persona-prompt";
import { COMMERCE_TOOL } from "@chatbot/domain";

describe("buildDeskSystemPrompt", () => {
  it("includes commerce search and English behavior layer", () => {
    const prompt = buildDeskSystemPrompt({
      companyInstructions: "We sell clothes.",
      hasCommerce: true,
    });
    expect(prompt).toContain(COMMERCE_TOOL.searchProducts);
    expect(prompt).not.toContain("__desk:");
    expect(prompt).not.toContain("Grafo de venta");
    expect(prompt).toContain("Do not invent");
  });

  it("mentions integrations code mode when enabled", () => {
    const prompt = buildDeskSystemPrompt({
      companyInstructions: "",
      hasTools: true,
      integrationCodeMode: true,
    });
    expect(prompt).toContain("desk_codemode");
  });

  it("mentions legacy integration meta tools when code mode off", () => {
    const prompt = buildDeskSystemPrompt({
      companyInstructions: "",
      hasTools: true,
      integrationCodeMode: false,
    });
    expect(prompt).toContain("desk_search_integrations");
  });

  it("does not treat phone as default order lookup", () => {
    const prompt = buildDeskSystemPrompt({
      companyInstructions: "",
      hasCommerce: true,
    });
    expect(prompt).toContain("Do not lead with phone");
  });
});
