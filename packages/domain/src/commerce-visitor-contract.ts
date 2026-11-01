import type { DeskCommand } from "./desk-action";
import { deskCommandDisplayLabel, deskCommandToInternal } from "./desk-action";
import { NATIVE_COMMERCE_LEAD } from "./commerce-native-messages";

/** Tipos de bloque desk-ui (alineados con @chatbot/chat-ui). */
export const DESK_UI_BLOCK_TYPE = {
  productCatalog: "product_catalog",
  cart: "cart",
  choices: "choices",
  products: "products",
  offers: "offers",
  html: "html",
  gen: "gen",
  host: "host",
} as const;

export type DeskUiBlockType =
  (typeof DESK_UI_BLOCK_TYPE)[keyof typeof DESK_UI_BLOCK_TYPE];

/** Nombres estables de herramientas commerce_* expuestas al LLM. */
export const COMMERCE_TOOL = {
  searchProducts: "commerce_search_products",
  getProductDetails: "commerce_get_product_details",
  cartGet: "commerce_cart_get",
  cartAdd: "commerce_cart_add",
  cartUpdate: "commerce_cart_update",
  setBuyer: "commerce_set_buyer",
  startCheckout: "commerce_start_checkout",
  getOrder: "commerce_get_order",
  getPaymentStatus: "commerce_get_payment_status",
  offerAction: "commerce_offer_action",
  viewCart: "commerce_view_cart",
  provideBuyerFields: "commerce_provide_buyer_fields",
  setFulfillment: "commerce_set_fulfillment",
  beginPayment: "commerce_begin_payment",
} as const;

/** Herramientas del harness agente (no commerce nativo). */
export const DESK_AGENT_TOOL = {
  visitorMessage: "desk_visitor_message",
  escalateHuman: "desk_escalate_to_human",
} as const;

export type CommerceTurnHandler = "native" | "agent";

/** Acciones de botón/modal resueltas en servidor sin LLM (tryNativeCommerceTurn). */
export type NativeDeskActionSpec = {
  kind: DeskCommand["kind"];
  handler: "native";
  visitorLabel: string;
  internalMessage: string;
  runtimeOutcome: string;
  deskUiBlocks: DeskUiBlockType[];
  agentAfterNative: string;
  /** Clave en NATIVE_COMMERCE_LEAD cuando la prosa es fija (turno nativo). */
  nativeLeadKey?: keyof typeof NATIVE_COMMERCE_LEAD;
};

const nativeSpecs: NativeDeskActionSpec[] = [
  {
    kind: "menu",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({ kind: "menu" }),
    internalMessage: deskCommandToInternal({ kind: "menu" }),
    runtimeOutcome:
      "Lista productos publicados y abre modal de catálogo; añade choices (Pagar / carrito / Menú) si hay líneas en carrito.",
    deskUiBlocks: [
      DESK_UI_BLOCK_TYPE.productCatalog,
      DESK_UI_BLOCK_TYPE.choices,
    ],
    agentAfterNative:
      "No repitas el catálogo ni prometas «mostrar» sin picker; el visitante ya vio la UI. Responde en prosa breve si pregunta algo nuevo.",
  },
  {
    kind: "cart",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({ kind: "cart" }),
    internalMessage: deskCommandToInternal({ kind: "cart" }),
    runtimeOutcome:
      "Muestra bloque cart con líneas y total, o avisa carrito vacío con choice Menú.",
    deskUiBlocks: [DESK_UI_BLOCK_TYPE.cart, DESK_UI_BLOCK_TYPE.choices],
    agentAfterNative:
      "Resume totales solo si lo piden; no reconstruyas el carrito en prosa línea a línea.",
  },
  {
    kind: "pay",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({ kind: "pay" }),
    internalMessage: deskCommandToInternal({ kind: "pay" }),
    runtimeOutcome:
      "Valida carrito, consentimiento y datos de comprador; inicia checkout o pide el siguiente campo / consentimiento.",
    deskUiBlocks: [DESK_UI_BLOCK_TYPE.choices],
    agentAfterNative:
      "Si ya hay link de pago en el turno anterior, no generes otro; confirma el paso siguiente.",
  },
  {
    kind: "consent",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({ kind: "consent" }),
    internalMessage: deskCommandToInternal({ kind: "consent" }),
    runtimeOutcome: "Registra consentimiento de datos y continúa comprador o checkout.",
    deskUiBlocks: [DESK_UI_BLOCK_TYPE.choices],
    agentAfterNative: "No vuelvas a pedir consentimiento en el mismo flujo.",
  },
  {
    kind: "confirm_price",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({ kind: "confirm_price" }),
    internalMessage: deskCommandToInternal({ kind: "confirm_price" }),
    runtimeOutcome:
      "Reintenta checkout tras confirmación de cambio de precio o carrito.",
    deskUiBlocks: [],
    agentAfterNative: "Explica el resultado del checkout, no inventes totales.",
  },
  {
    kind: "view_product",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({
      kind: "view_product",
      productId: "…",
    }),
    internalMessage: deskCommandToInternal({
      kind: "view_product",
      productId: "…",
    }),
    runtimeOutcome:
      "Ficha html del producto + choices (Añadir, carrito, Menú) con stock/cantidad nativos.",
    deskUiBlocks: [DESK_UI_BLOCK_TYPE.html, DESK_UI_BLOCK_TYPE.choices],
    agentAfterNative:
      "No dupliques ficha; usa commerce_get_product_details solo si el visitante escribe en prosa.",
  },
  {
    kind: "add",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({ kind: "add", productId: "…" }),
    internalMessage: deskCommandToInternal({ kind: "add", productId: "…" }),
    runtimeOutcome:
      "Flujo cantidad/notas/stock; actualiza carrito y choices post-carrito.",
    deskUiBlocks: [DESK_UI_BLOCK_TYPE.cart, DESK_UI_BLOCK_TYPE.choices],
    agentAfterNative:
      "El carrito ya mutó en servidor; alinea prosa con «Carrito y sesión», no uses cart_add sin tool.",
  },
  {
    kind: "set_qty",
    handler: "native",
    visitorLabel: deskCommandDisplayLabel({
      kind: "set_qty",
      productId: "…",
      quantity: 0,
    }),
    internalMessage: deskCommandToInternal({
      kind: "set_qty",
      productId: "…",
      quantity: 0,
    }),
    runtimeOutcome: "Actualiza cantidad o quita línea; muestra cart actualizado.",
    deskUiBlocks: [DESK_UI_BLOCK_TYPE.cart, DESK_UI_BLOCK_TYPE.choices],
    agentAfterNative: "Misma regla que add: estado ya aplicado.",
  },
];

export const NATIVE_DESK_ACTION_CONTRACT: ReadonlyArray<NativeDeskActionSpec> =
  nativeSpecs;

export function nativeDeskActionSpec(
  kind: DeskCommand["kind"],
): NativeDeskActionSpec | undefined {
  return nativeSpecs.find((s) => s.kind === kind);
}

export function assistantTextIncludesDeskBlock(
  text: string,
  blockType: DeskUiBlockType,
): boolean {
  return (
    text.includes(`"type":"${blockType}"`) ||
    text.includes(`"type": "${blockType}"`)
  );
}
