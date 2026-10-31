import type { CommerceBuyer } from "./commerce-types";
import { deskCommandDisplayLabel } from "./desk-action";

/** Etiquetas visibles de botones (chat). Comandos internos en desk-action-commands. */
export const COMMERCE_VISITOR_LABEL = {
  catalogModalButton: "Ver productos",
  addToCart: "Añadir al carrito",
  viewProductsFromDetail: "Ver productos",
  menu: deskCommandDisplayLabel({ kind: "menu" }),
  cart: deskCommandDisplayLabel({ kind: "cart" }),
  pay: deskCommandDisplayLabel({ kind: "pay" }),
  consent: deskCommandDisplayLabel({ kind: "consent" }),
  confirmPriceButton: "Confirmar",
} as const;

/** Prosa fija del turno nativo (sin LLM). */
export const NATIVE_COMMERCE_LEAD = {
  catalogEmpty: "Por ahora no hay productos publicados.",
  catalogBrowse: "Estos son nuestros productos publicados:",
  productUnavailable: "Ese producto ya no está disponible.",
  cartEmpty: "Tu carrito está vacío.",
  cartEmptied: "Tu carrito quedó vacío.",
  cartShow: "Este es tu carrito:",
  cartUpdated: "Carrito actualizado.",
  cartAddSuccess: "Listo, lo añadí al carrito.",
  payNeedItems: "Primero añade productos al carrito.",
  payLink: "Aquí va tu link de pago.",
  checkoutLink: "Perfecto. Abre el enlace para pagar de forma segura.",
  insufficientStock: "No hay stock suficiente en este momento.",
  insufficientStockWithNotes:
    "No hay stock suficiente para esa cantidad con la nota indicada.",
  noUnitsAvailable: "Ahora no hay unidades libres",
  consentBeforePay:
    "Para el pago necesitamos tus datos de contacto y entrega.",
  fulfillmentMode: "¿Cómo quieres recibir tu pedido?",
  buyerFieldFallback: "¿Me compartes ese dato?",
} as const;

export const COMMERCE_BUYER_FIELD_PROMPT: Partial<
  Record<keyof CommerceBuyer, string>
> = {
  name: "¿Cuál es tu nombre completo?",
  documentId:
    "¿Cuál es tu número de documento de identidad? (solo números)",
  phone: "¿Tu número de celular?",
  city: "¿En qué ciudad?",
  address: "¿Cuál es tu dirección? (domicilio)",
};

export function nativeBuyerFieldPrompt(
  field: keyof CommerceBuyer,
): string {
  return (
    COMMERCE_BUYER_FIELD_PROMPT[field] ?? NATIVE_COMMERCE_LEAD.buyerFieldFallback
  );
}

export function nativeLineNotesPrompt(productLabel: string): string {
  return `¿Qué adiciones o nota quieres para ${productLabel}?`;
}

export function nativeQuantityAskPrompt(
  productName: string,
  rangeLabel: string,
): string {
  return `¿Cuántas unidades de ${productName}? Escribe un número entre ${rangeLabel}.`;
}

export function nativeInvalidQuantityPrompt(rangeLabel: string): string {
  return `Escribe solo un número entre ${rangeLabel}.`;
}

export function nativeCartAddFailed(code: string | undefined): string {
  return `No pude añadirlo (${code ?? "error"}).`;
}

export function nativeCheckoutFailedGeneric(code: string | undefined): string {
  return `No pude iniciar el pago (${code ?? "checkout_failed"}).`;
}

export function nativePriceChangedLead(totalFormatted: string): string {
  return `El total actualizado es ${totalFormatted}.`;
}

/** Códigos de error de checkout conocidos → mensaje visitante. */
export const NATIVE_CHECKOUT_FAILURE: Record<string, string> = {
  turnstile_not_configured:
    "El pago en línea no está disponible: falta configurar la verificación de seguridad (Turnstile) en Desk.",
  turnstile_required:
    "Completa la verificación de seguridad debajo para continuar con el pago.",
  turnstile_failed: "No pudimos validar la verificación. Intenta de nuevo.",
  payment_provider_not_active:
    "La pasarela de pago no está activa o las credenciales no son válidas. Revisa Wompi en el panel.",
  integration_not_active:
    "La pasarela de pago no está activa o las credenciales no son válidas. Revisa Wompi en el panel.",
  encryption_not_configured:
    "La pasarela de pago no está activa o las credenciales no son válidas. Revisa Wompi en el panel.",
  decrypt_failed:
    "La pasarela de pago no está activa o las credenciales no son válidas. Revisa Wompi en el panel.",
  checkout_in_progress:
    "Ya hay un pago en curso en la tienda. Termínalo allí o espera unos minutos.",
  insufficient_stock:
    "Tu carrito ya no cabe en el stock disponible (otras personas pueden tener unidades reservadas). Actualiza cantidades o espera unos minutos.",
};

export type NativeCheckoutFailureKind =
  | { type: "text"; message: string }
  | { type: "buyer_consent" }
  | { type: "price_confirm"; totalFormatted: string };

export function resolveNativeCheckoutFailure(args: {
  code?: string;
  subtotalCents?: number;
  currency?: string;
  cartCurrency: string;
  formatMoney: (cents: number, currency: string) => string;
}): NativeCheckoutFailureKind {
  const code = args.code ?? "";
  if (code === "buyer_consent_required") {
    return { type: "buyer_consent" };
  }
  if (
    (code === "price_changed" || code === "cart_changed") &&
    args.subtotalCents != null
  ) {
    const cur = args.currency ?? args.cartCurrency;
    return {
      type: "price_confirm",
      totalFormatted: args.formatMoney(args.subtotalCents, cur),
    };
  }
  const mapped = NATIVE_CHECKOUT_FAILURE[code];
  if (mapped) return { type: "text", message: mapped };
  return {
    type: "text",
    message: nativeCheckoutFailedGeneric(code || undefined),
  };
}
