import { describe, expect, it } from "vitest";
import {
  DESK_CMD_MENU,
  deskCmdAdd,
  deskCmdProduct,
} from "./desk-action-commands";
import { parseInternalDeskCommand } from "./desk-action";
import {
  assistantTextIncludesDeskBlock,
  DESK_UI_BLOCK_TYPE,
  nativeDeskActionSpec,
} from "./commerce-visitor-contract";

describe("parseInternalDeskCommand", () => {
  it("reconoce menú y producto", () => {
    expect(parseInternalDeskCommand(DESK_CMD_MENU)).toEqual({ kind: "menu" });
    expect(parseInternalDeskCommand(deskCmdProduct("sku-1"))).toEqual({
      kind: "view_product",
      productId: "sku-1",
    });
    expect(parseInternalDeskCommand(deskCmdAdd("sku-1", 2))).toEqual({
      kind: "add",
      productId: "sku-1",
      quantity: 2,
    });
  });
});

describe("commerce-visitor-contract", () => {
  it("documenta menú como catálogo nativo", () => {
    const menu = nativeDeskActionSpec("menu");
    expect(menu?.deskUiBlocks).toContain(DESK_UI_BLOCK_TYPE.productCatalog);
    expect(menu?.visitorLabel).toContain("Menú");
  });

  it("detecta bloques desk-ui en texto", () => {
    const text = `\`\`\`desk-ui\n{"blocks":[{"type":"${DESK_UI_BLOCK_TYPE.productCatalog}","items":[]}]}\n\`\`\``;
    expect(
      assistantTextIncludesDeskBlock(text, DESK_UI_BLOCK_TYPE.productCatalog),
    ).toBe(true);
  });
});
