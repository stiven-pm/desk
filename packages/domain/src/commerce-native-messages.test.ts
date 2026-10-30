import { describe, expect, it } from "vitest";
import {
  COMMERCE_VISITOR_LABEL,
  NATIVE_COMMERCE_LEAD,
  nativeLineNotesPrompt,
  resolveNativeCheckoutFailure,
} from "./commerce-native-messages";

describe("commerce-native-messages", () => {
  it("expone etiquetas alineadas con desk-action", () => {
    expect(COMMERCE_VISITOR_LABEL.menu).toBe("Menú");
    expect(COMMERCE_VISITOR_LABEL.catalogModalButton).toBe("Ver productos");
  });

  it("plantillas parametrizadas", () => {
    expect(nativeLineNotesPrompt("Papas")).toContain("Papas");
  });

  it("checkout price_confirm", () => {
    const r = resolveNativeCheckoutFailure({
      code: "price_changed",
      subtotalCents: 5000,
      cartCurrency: "COP",
      formatMoney: (c, cur) => `${c / 100} ${cur}`,
    });
    expect(r.type).toBe("price_confirm");
    if (r.type === "price_confirm") {
      expect(r.totalFormatted).toContain("COP");
    }
  });

  it("leads estables para carrito vacío", () => {
    expect(NATIVE_COMMERCE_LEAD.cartEmpty.length).toBeGreaterThan(5);
  });
});
