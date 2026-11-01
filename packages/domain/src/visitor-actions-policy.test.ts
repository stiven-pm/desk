import { describe, expect, it } from "vitest";
import {
  DESK_CMD_CONSENT,
  DESK_CMD_HUMAN,
  DESK_CMD_MENU,
  DESK_CMD_PAY,
} from "./desk-action-commands";
import {
  MAX_VISITOR_ACTION_BUTTONS,
  resolveVisitorActions,
  turnKindAllowsActions,
  VISITOR_TURN_KINDS_WITHOUT_ACTIONS,
} from "./visitor-actions-policy";

describe("resolveVisitorActions", () => {
  it("line_notes y buyer_field no devuelven botones", () => {
    for (const turnKind of ["line_notes", "buyer_field", "pick_qty"] as const) {
      const items = resolveVisitorActions({
        turnKind,
        phase: "automated",
        cartLineCount: 2,
        hasPublishedCatalog: true,
      });
      expect(items).toEqual([]);
      expect(VISITOR_TURN_KINDS_WITHOUT_ACTIONS.has(turnKind)).toBe(true);
    }
  });

  it("buyer_consent solo Acepto", () => {
    const items = resolveVisitorActions({
      turnKind: "buyer_consent",
      phase: "automated",
      cartLineCount: 1,
      hasPublishedCatalog: true,
    });
    expect(items.map((i) => i.message)).toEqual([DESK_CMD_CONSENT]);
  });

  it("greeting con catálogo y carrito: menú y carrito, sin humano", () => {
    const items = resolveVisitorActions({
      turnKind: "greeting",
      phase: "automated",
      cartLineCount: 2,
      hasPublishedCatalog: true,
    });
    expect(items.some((i) => i.message === DESK_CMD_MENU)).toBe(true);
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });

  it("faq con catálogo no fuerza menú", () => {
    const items = resolveVisitorActions({
      turnKind: "faq",
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: true,
    });
    expect(items.some((i) => i.message === DESK_CMD_MENU)).toBe(false);
  });

  it("service no fuerza menú ni humano", () => {
    const items = resolveVisitorActions({
      turnKind: "service",
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: true,
    });
    expect(items.some((i) => i.message === DESK_CMD_MENU)).toBe(false);
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });

  it("offer_human no muestra botón (runtime no usa turnKind desde modelo)", () => {
    const items = resolveVisitorActions({
      turnKind: "offer_human",
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: true,
    });
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });

  it("handoff en needs_human no repite botón humano", () => {
    const items = resolveVisitorActions({
      turnKind: "handoff",
      phase: "needs_human",
      cartLineCount: 0,
      hasPublishedCatalog: true,
    });
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });

  it("agent_struggling no muestra humano", () => {
    const items = resolveVisitorActions({
      turnKind: "agent_struggling",
      phase: "automated",
      cartLineCount: 0,
      hasPublishedCatalog: false,
    });
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(false);
  });

  it("capa a MAX_VISITOR_ACTION_BUTTONS", () => {
    const items = resolveVisitorActions({
      turnKind: "cart_updated",
      phase: "automated",
      cartLineCount: 3,
      hasPublishedCatalog: true,
      extraChoices: [{ label: "Extra", message: "__desk:extra__" }],
    });
    expect(items.length).toBeLessThanOrEqual(MAX_VISITOR_ACTION_BUTTONS);
    expect(items.some((i) => i.message === DESK_CMD_PAY)).toBe(true);
  });

  it("fulfillment_mode expone recoger y domicilio", () => {
    const items = resolveVisitorActions({
      turnKind: "fulfillment_mode",
      phase: "automated",
      cartLineCount: 1,
      hasPublishedCatalog: true,
    });
    expect(items.length).toBe(2);
    expect(VISITOR_TURN_KINDS_WITHOUT_ACTIONS.has("fulfillment_mode")).toBe(
      false,
    );
    expect(turnKindAllowsActions("fulfillment_mode")).toBe(true);
  });

  it("checkout blocked reintento con humano tras 2 intentos", () => {
    const items = resolveVisitorActions({
      turnKind: "checkout",
      phase: "automated",
      cartLineCount: 2,
      hasPublishedCatalog: true,
      checkoutFlow: {
        phase: "blocked",
        lastBlocker: "turnstile_failed",
        attempts: 2,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(items.some((i) => i.label === "Reintentar pago")).toBe(true);
    expect(items.some((i) => i.message === DESK_CMD_PAY)).toBe(true);
    expect(items.some((i) => i.message === DESK_CMD_HUMAN)).toBe(true);
    expect(
      turnKindAllowsActions("checkout", {
        phase: "blocked",
        lastBlocker: "turnstile_failed",
        attempts: 2,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});
