import { describe, expect, it } from "vitest";
import { buildVisitorStateBarChoices } from "./visitor-state-bar";
import { DESK_CMD_HUMAN, DESK_CMD_MENU } from "./desk-action-commands";

describe("buildVisitorStateBarChoices", () => {
  it("incluye menú y humano con catálogo publicado", () => {
    const items = buildVisitorStateBarChoices({
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: true,
      responseHasChoices: false,
      responseHasProductCatalog: false,
    });
    expect(items.some((i) => i.message === DESK_CMD_MENU)).toBe(true);
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });

  it("no incluye humano permanente sin catálogo", () => {
    const items = buildVisitorStateBarChoices({
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: false,
      responseHasChoices: false,
      responseHasProductCatalog: false,
    });
    expect(items.some((i) => i.message === DESK_CMD_MENU)).toBe(false);
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });
});
