import { describe, expect, it } from "vitest";
import { DESK_CMD_CONSENT, DESK_CMD_HUMAN, DESK_CMD_MENU } from "@chatbot/domain";
import { deskUiFence } from "./commerce-ui";
import { applyVisitorAssistantActionHarness } from "./visitor-assistant-harness";
import { checkVisitorAssistantUiInvariants } from "./visitor-assistant-ui-invariants";

describe("applyVisitorAssistantActionHarness", () => {
  it("buyer_field sin botones y un solo bloque choices vacío omitido", () => {
    const out = applyVisitorAssistantActionHarness({
      text: "¿Tu número de celular?",
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: true,
      turnKind: "buyer_field",
    });
    expect(checkVisitorAssistantUiInvariants(out, "buyer_field")).toEqual([]);
    expect(out.includes('"type":"choices"')).toBe(false);
  });

  it("buyer_consent solo Acepto tras harness", () => {
    const out = applyVisitorAssistantActionHarness({
      text: "Para el pago necesitamos tus datos.",
      phase: "automated",
      cartLineCount: 1,
      hasPublishedCatalog: true,
      turnKind: "buyer_consent",
    });
    expect(checkVisitorAssistantUiInvariants(out, "buyer_consent")).toEqual([]);
    expect(out).toContain(DESK_CMD_CONSENT);
    expect(out).not.toContain(DESK_CMD_HUMAN);
  });

  it("product_detail fusiona cart + html sin duplicar choices", () => {
    const cartFence = deskUiFence([
      {
        type: "cart",
        currency: "COP",
        lines: [{ productId: "p1", name: "X", priceCents: 100, quantity: 1 }],
      },
    ]);
    const htmlFence = deskUiFence([{ type: "html", html: "<p>Ficha</p>" }]);
    const out = applyVisitorAssistantActionHarness({
      text: `${htmlFence}${cartFence}`,
      phase: "automated",
      cartLineCount: 1,
      hasPublishedCatalog: true,
      turnKind: "product_detail",
      actionProductId: "p1",
    });
    expect(checkVisitorAssistantUiInvariants(out, "product_detail")).toEqual([]);
    expect(out).toContain(DESK_CMD_MENU);
  });

  it("struggle_count fuerza humano en cuerpo", () => {
    const out = applyVisitorAssistantActionHarness({
      text: "No encontré eso.",
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: true,
      turnKind: "faq",
      struggleCount: 2,
    });
    expect(out).toContain(DESK_CMD_HUMAN);
    expect(out).toContain(DESK_CMD_MENU);
  });
});
