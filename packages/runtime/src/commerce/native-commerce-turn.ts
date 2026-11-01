import type { CommerceBuyer, CommerceCart } from "@chatbot/domain";
import {
  CHECKOUT_FLOW_META_KEY,
  COMMERCE_VISITOR_LABEL,
  missingCommerceBuyerFields,
  NATIVE_COMMERCE_LEAD,
  nativeBuyerFieldPrompt,
  nativeCartAddFailed,
  nativeLineNotesPrompt,
  nativePriceChangedLead,
  parseCheckoutFlow,
  parseInternalDeskCommand,
  resolveNativeCheckoutFailure,
  validateCommerceBuyerField,
  type VisitorStateBarChoice,
  type VisitorTurnKind,
} from "@chatbot/domain";
import type { CommerceService } from "./commerce-service";
import { parseCart } from "./cart-store";
import {
  advanceCheckout,
  flowFromAdvance,
  type AdvanceResult,
} from "./checkout-advance";
import {
  appendCartDeskUiFence,
  appendCheckoutPaymentDeskUi,
  buildBuyerConsentLead,
  buildFulfillmentModeLead,
  buildInvalidQuantityReply,
  buildProductDetailDeskUi,
  buildQuantityPickerDeskUi,
  DESK_CMD_CONFIRM_PRICE,
  formatMoneyCents,
} from "./commerce-ui";
import {
  getPublishedProduct,
  listPublishedProductsBrowse,
  type NativeProductRow,
} from "./native-catalog";
import { NATIVE_MENU_BROWSE_LIMIT } from "./catalog-search";
import { reservedQtyForProduct } from "./stock-reservations";
import { buildNoStockVisitorReply } from "./stock-availability";
import { buildProductCatalogPickerDeskUi } from "./native-catalog-ui";
import { chatCatalogTitle } from "./native-catalog";
import {
  parseVisitorQuantityMessage,
  validateAddQuantityForRow,
  maxAddQuantityForRow,
} from "./visitor-quantity";

const META_LINKED_STORE_CART = "linked_store_cart_json";
const META_COMMERCE_UX = "commerce_ux_json";

async function ensureCheckoutCartFromLinked(
  svc: CommerceService,
  getMeta: (key: string) => string | null,
  fetchLinkedStoreCart?: () => Promise<CommerceCart | null>,
): Promise<void> {
  if (svc.usesLinkedStoreCart()) {
    await svc.pullLinkedStoreMirror();
    return;
  }
  if (svc.getCart().lines.length) return;
  const live = fetchLinkedStoreCart ? await fetchLinkedStoreCart() : null;
  const linked =
    live?.lines.length ? live : parseCart(getMeta(META_LINKED_STORE_CART));
  for (const line of linked.lines) {
    await svc.cartAdd({
      productId: line.productId,
      name: line.name,
      priceCents: line.priceCents,
      quantity: line.quantity,
      currency: line.currency,
      imageUrl: line.imageUrl,
      lineNotes: line.lineNotes,
    });
  }
}

function cartForCommands(svc: CommerceService) {
  return svc.getCart();
}

type CommerceUxState =
  | { mode: "line_notes"; productId: string; quantity: number }
  | { mode: "pick_qty"; productId: string }
  | { mode: "buyer"; field: keyof CommerceBuyer };

async function nextBuyerField(
  svc: CommerceService,
  buyer: CommerceBuyer | null,
): Promise<keyof CommerceBuyer | null> {
  const manifest = await svc.loadManifest();
  const missing = missingCommerceBuyerFields(buyer, manifest);
  const order = await svc.buyerFieldOrder(buyer?.type ?? "natural_person");
  for (const field of order) {
    if (missing.includes(field)) return field;
  }
  return null;
}

function buyerPrompt(field: keyof CommerceBuyer): string {
  return nativeBuyerFieldPrompt(field);
}

async function persistBuyerAndContinue(args: {
  svc: CommerceService;
  setMeta: (key: string, value: string) => void;
  clearUx: () => void;
  payArgs: Parameters<typeof continueTowardCheckout>[0];
  buyer: CommerceBuyer;
}): Promise<NativeCommerceTurnResult> {
  await args.svc.persistBuyer(args.buyer);
  args.svc.clearCheckoutFulfillment();
  const next = await nextBuyerField(args.svc, args.buyer);
  if (next) {
    args.setMeta(
      META_COMMERCE_UX,
      JSON.stringify({ mode: "buyer", field: next }),
    );
    return nativeTurn(buyerPrompt(next), "buyer_field");
  }
  args.clearUx();
  return continueTowardCheckout(args.payArgs);
}

function parseUx(raw: string | null): CommerceUxState | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as CommerceUxState;
    if (o.mode === "line_notes" && o.productId) {
      const qty =
        typeof (o as { quantity?: number }).quantity === "number"
          ? Math.min(99, Math.max(1, (o as { quantity: number }).quantity))
          : 1;
      return { mode: "line_notes", productId: o.productId, quantity: qty };
    }
    if (o.mode === "pick_qty" && o.productId) {
      return { mode: "pick_qty", productId: o.productId };
    }
    if (o.mode === "buyer" && o.field) return o;
    return null;
  } catch {
    return null;
  }
}

function parsePickQtyReply(
  text: string,
  productId: string,
): number | null {
  const cmd = parseInternalDeskCommand(text);
  if (
    cmd?.kind === "add" &&
    cmd.productId === productId &&
    cmd.quantity != null
  ) {
    return cmd.quantity;
  }
  return parseVisitorQuantityMessage(text);
}

async function stockLimitsForAdd(
  db: D1Database,
  orgId: string,
  svc: CommerceService,
  row: NativeProductRow,
  lineNotes?: string,
): Promise<{ reservedOthers: number; maxAdd: number }> {
  const reservedOthers = await reservedQtyForProduct(
    db,
    orgId,
    row.id,
    svc.getConversationId(),
  );
  const maxAdd = maxAddQuantityForRow(
    row,
    svc.getCart(),
    reservedOthers,
    lineNotes,
  );
  return { reservedOthers, maxAdd };
}

async function noStockVisitorReply(
  db: D1Database,
  orgId: string,
  svc: CommerceService,
  row: NativeProductRow,
  lineNotes?: string,
): Promise<string> {
  const { reservedOthers, maxAdd } = await stockLimitsForAdd(
    db,
    orgId,
    svc,
    row,
    lineNotes,
  );
  return buildNoStockVisitorReply({ row, maxAdd, reservedOthers });
}

export type NativeCommerceTurnResult = {
  assistantText: string;
  turnKind: VisitorTurnKind;
  actionProductId?: string;
  harnessExtraChoices?: VisitorStateBarChoice[];
  checkoutUrl?: string;
  commerceCode?: string;
};

function nativeTurn(
  assistantText: string,
  turnKind: VisitorTurnKind,
  extra?: Omit<NativeCommerceTurnResult, "assistantText" | "turnKind">,
): NativeCommerceTurnResult {
  return { assistantText, turnKind, ...extra };
}

async function startPickQuantity(args: {
  db: D1Database;
  orgId: string;
  row: NativeProductRow;
  setMeta: (key: string, value: string) => void;
  svc: CommerceService;
}): Promise<NativeCommerceTurnResult> {
  const { reservedOthers, maxAdd } = await stockLimitsForAdd(
    args.db,
    args.orgId,
    args.svc,
    args.row,
  );
  if (maxAdd < 1) {
    return nativeTurn(
      buildNoStockVisitorReply({
        row: args.row,
        maxAdd,
        reservedOthers,
      }),
      "product_detail",
    );
  }
  args.setMeta(
    META_COMMERCE_UX,
    JSON.stringify({ mode: "pick_qty", productId: args.row.id }),
  );
  return nativeTurn(
    buildQuantityPickerDeskUi(args.row, maxAdd),
    "pick_qty",
    { actionProductId: args.row.id },
  );
}

async function addProductWithQuantity(args: {
  db: D1Database;
  orgId: string;
  row: NativeProductRow;
  quantity: number;
  setMeta: (key: string, value: string) => void;
  svc: CommerceService;
}): Promise<NativeCommerceTurnResult> {
  const { db, orgId, row, setMeta, svc } = args;
  const { reservedOthers } = await stockLimitsForAdd(db, orgId, svc, row);
  const valid = validateAddQuantityForRow(
    row,
    args.quantity,
    svc.getCart(),
    reservedOthers,
  );
  if (!valid.ok) {
    return nativeTurn(valid.message, "pick_qty", { actionProductId: row.id });
  }
  const quantity = valid.quantity;
  if (Number(row.allows_additions) === 1) {
    setMeta(
      META_COMMERCE_UX,
      JSON.stringify({
        mode: "line_notes",
        productId: row.id,
        quantity,
      }),
    );
    return nativeTurn(nativeLineNotesPrompt(row.name), "line_notes", {
      actionProductId: row.id,
    });
  }
  const added = await svc.cartAdd({
    productId: row.id,
    name: chatCatalogTitle(row),
    imageUrl: row.image_url ?? undefined,
    currency: row.currency,
    quantity,
  });
  if (!added.ok) {
    if (added.code === "insufficient_stock") {
      const { maxAdd } = await stockLimitsForAdd(db, orgId, svc, row);
      const again = validateAddQuantityForRow(
        row,
        quantity,
        svc.getCart(),
        reservedOthers,
      );
      return nativeTurn(
        again.ok ? NATIVE_COMMERCE_LEAD.insufficientStock : again.message,
        "cart_updated",
      );
    }
    return nativeTurn(nativeCartAddFailed(added.code), "faq");
  }
  return nativeTurn(
    appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartAddSuccess, added.cart),
    "cart_updated",
  );
}

function checkoutFailureNativeTurn(
  checkout: { code?: string; subtotalCents?: number; currency?: string },
  cartCurrency: string,
): NativeCommerceTurnResult {
  const resolved = resolveNativeCheckoutFailure({
    code: checkout.code,
    subtotalCents: checkout.subtotalCents,
    currency: checkout.currency,
    cartCurrency,
    formatMoney: formatMoneyCents,
  });
  if (resolved.type === "buyer_consent") {
    return nativeTurn(buildBuyerConsentLead(), "buyer_consent");
  }
  if (checkout.code === "fulfillment_required") {
    return nativeTurn(buildFulfillmentModeLead(), "fulfillment_mode");
  }
  if (resolved.type === "price_confirm") {
    return nativeTurn(nativePriceChangedLead(resolved.totalFormatted), "checkout", {
      harnessExtraChoices: [
        {
          label: COMMERCE_VISITOR_LABEL.confirmPriceButton,
          message: DESK_CMD_CONFIRM_PRICE,
        },
      ],
    });
  }
  return nativeTurn(resolved.message, "checkout", { commerceCode: checkout.code });
}

async function continueTowardCheckout(args: {
  svc: CommerceService;
  getMeta: (key: string) => string | null;
  setMeta: (key: string, value: string) => void;
  turnstileToken?: string;
  checkoutOpts?: {
    confirmPriceChange?: boolean;
    confirmCartChange?: boolean;
  };
}): Promise<NativeCommerceTurnResult> {
  const { svc, getMeta, setMeta, turnstileToken, checkoutOpts } = args;
  const prev = parseCheckoutFlow(getMeta(CHECKOUT_FLOW_META_KEY));
  const r = await advanceCheckout(svc, {
    turnstileToken,
    ...checkoutOpts,
  });
  setMeta(
    CHECKOUT_FLOW_META_KEY,
    JSON.stringify(flowFromAdvance(prev, r)),
  );

  switch (r.step) {
    case "ask_fields": {
      const field = r.fields[0];
      if (!field) {
        setMeta(META_COMMERCE_UX, "");
        return continueTowardCheckout(args);
      }
      setMeta(
        META_COMMERCE_UX,
        JSON.stringify({ mode: "buyer", field }),
      );
      return nativeTurn(
        buyerPrompt(field as keyof CommerceBuyer),
        "buyer_field",
      );
    }
    case "ask_consent":
      setMeta(META_COMMERCE_UX, "");
      return nativeTurn(buildBuyerConsentLead(), "buyer_consent");
    case "ask_fulfillment":
      setMeta(META_COMMERCE_UX, "");
      return nativeTurn(buildFulfillmentModeLead(), "fulfillment_mode");
    case "confirm_price":
      return nativeTurn(
        nativePriceChangedLead(r.totalFormatted ?? ""),
        "checkout",
        {
          harnessExtraChoices: [
            {
              label: COMMERCE_VISITOR_LABEL.confirmPriceButton,
              message: DESK_CMD_CONFIRM_PRICE,
            },
          ],
        },
      );
    case "link_ready":
      return nativeTurn(
        appendCheckoutPaymentDeskUi(
          NATIVE_COMMERCE_LEAD.checkoutLink,
          r.checkoutUrl,
        ),
        "checkout",
        { checkoutUrl: r.checkoutUrl },
      );
    case "blocked":
      return checkoutFailureNativeTurn({ code: r.blocker }, svc.getCart().currency);
  }
}

async function applyFulfillmentModeAndCheckout(args: {
  svc: CommerceService;
  getMeta: (key: string) => string | null;
  setMeta: (key: string, value: string) => void;
  mode: "pickup" | "delivery";
  turnstileToken?: string;
}): Promise<NativeCommerceTurnResult> {
  const { svc, getMeta, setMeta, mode, turnstileToken } = args;
  const buyer = svc.getBuyer();
  if (!buyer) {
    return continueTowardCheckout({
      svc,
      getMeta,
      setMeta,
      turnstileToken,
    });
  }
  if (mode === "delivery" && !buyer.address?.trim()) {
    setMeta(
      META_COMMERCE_UX,
      JSON.stringify({ mode: "buyer", field: "address" }),
    );
    return nativeTurn(buyerPrompt("address"), "buyer_field");
  }
  svc.setCheckoutFulfillment(svc.fulfillmentFromBuyer(mode, buyer));
  if (!svc.hasBuyerConsent()) {
    return nativeTurn(buildBuyerConsentLead(), "buyer_consent");
  }
  return continueTowardCheckout({
    svc,
    getMeta,
    setMeta,
    turnstileToken,
  });
}

export async function tryNativeCommerceTurn(args: {
  db: D1Database;
  orgId: string;
  text: string;
  getMeta: (key: string) => string | null;
  setMeta: (key: string, value: string) => void;
  svc: CommerceService;
  fetchLinkedStoreCart?: () => Promise<CommerceCart | null>;
  turnstileToken?: string;
  agentDrivenWizard?: boolean;
  agentFlowTools?: boolean;
}): Promise<NativeCommerceTurnResult | null> {
  const {
    db,
    orgId,
    text,
    getMeta,
    setMeta,
    svc,
    fetchLinkedStoreCart,
    turnstileToken,
    agentDrivenWizard,
    agentFlowTools,
  } = args;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const deskCmd = parseInternalDeskCommand(trimmed);
  if (
    agentFlowTools &&
    deskCmd &&
    (deskCmd.kind === "consent" ||
      deskCmd.kind === "fulfillment_pickup" ||
      deskCmd.kind === "fulfillment_delivery" ||
      deskCmd.kind === "confirm_price" ||
      deskCmd.kind === "pay")
  ) {
    return null;
  }

  const clearUx = () => setMeta(META_COMMERCE_UX, "");
  const ux = parseUx(getMeta(META_COMMERCE_UX));

  const payArgs = {
    svc,
    getMeta,
    setMeta,
    turnstileToken,
  };

  if (deskCmd?.kind === "consent") {
    await svc.recordBuyerConsentAsync();
    return continueTowardCheckout(payArgs);
  }

  if (deskCmd?.kind === "fulfillment_pickup") {
    return applyFulfillmentModeAndCheckout({
      ...payArgs,
      mode: "pickup",
    });
  }

  if (deskCmd?.kind === "fulfillment_delivery") {
    return applyFulfillmentModeAndCheckout({
      ...payArgs,
      mode: "delivery",
    });
  }

  if (deskCmd?.kind === "confirm_price") {
    await ensureCheckoutCartFromLinked(svc, getMeta, fetchLinkedStoreCart);
    return continueTowardCheckout({
      ...payArgs,
      checkoutOpts: {
        confirmPriceChange: true,
        confirmCartChange: true,
      },
    });
  }

  if (ux?.mode === "pick_qty") {
    const row = await getPublishedProduct(db, orgId, ux.productId);
    if (!row) {
      clearUx();
      return nativeTurn(NATIVE_COMMERCE_LEAD.productUnavailable, "faq");
    }
    const { reservedOthers, maxAdd } = await stockLimitsForAdd(
      db,
      orgId,
      svc,
      row,
    );
    const qty = parsePickQtyReply(trimmed, ux.productId);
    if (qty == null) {
      return nativeTurn(buildInvalidQuantityReply(row, maxAdd), "pick_qty", {
        actionProductId: row.id,
      });
    }
    const valid = validateAddQuantityForRow(
      row,
      qty,
      svc.getCart(),
      reservedOthers,
    );
    if (!valid.ok) {
      return nativeTurn(valid.message, "pick_qty", { actionProductId: row.id });
    }
    clearUx();
    return addProductWithQuantity({
      db,
      orgId,
      row,
      quantity: valid.quantity,
      setMeta,
      svc,
    });
  }

  if (ux?.mode === "line_notes") {
    const row = await getPublishedProduct(db, orgId, ux.productId);
    if (!row) {
      clearUx();
      return null;
    }
    const added = await svc.cartAdd({
      productId: row.id,
      name: row.name,
      lineNotes: trimmed,
      imageUrl: row.image_url ?? undefined,
      currency: row.currency,
      quantity: ux.quantity,
    });
    clearUx();
    if (!added.ok) {
      if (added.code === "insufficient_stock") {
        return nativeTurn(
          NATIVE_COMMERCE_LEAD.insufficientStockWithNotes,
          "line_notes",
          { actionProductId: row.id },
        );
      }
      return nativeTurn(nativeCartAddFailed(added.code), "faq");
    }
    return nativeTurn(
      appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartAddSuccess, added.cart),
      "cart_updated",
    );
  }

  if (ux?.mode === "buyer") {
    const prev = svc.getBuyer() ?? { type: "natural_person" as const };
    const field = ux.field;
    const checked = validateCommerceBuyerField(String(field), trimmed);
    if (!checked.ok) {
      if (agentDrivenWizard) return null;
      return nativeTurn(checked.message, "buyer_field");
    }
    const buyer: CommerceBuyer = {
      ...prev,
      type: "natural_person",
      [field]: checked.value,
    };
    return persistBuyerAndContinue({
      svc,
      setMeta,
      clearUx,
      payArgs,
      buyer,
    });
  }

  if (deskCmd?.kind === "menu") {
    clearUx();
    const rows = await listPublishedProductsBrowse(
      db,
      orgId,
      NATIVE_MENU_BROWSE_LIMIT,
    );
    if (!rows.length) {
      return nativeTurn(NATIVE_COMMERCE_LEAD.catalogEmpty, "faq");
    }
    const assistantText = buildProductCatalogPickerDeskUi(
      rows,
      COMMERCE_VISITOR_LABEL.catalogModalButton,
    );
    return nativeTurn(assistantText, "browse_catalog");
  }

  if (deskCmd?.kind === "cart") {
    const cart = cartForCommands(svc);
    if (!cart.lines.length) {
      return nativeTurn(NATIVE_COMMERCE_LEAD.cartEmpty, "cart_view");
    }
    return nativeTurn(
      appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartShow, cart),
      "cart_view",
    );
  }

  if (deskCmd?.kind === "pay") {
    await ensureCheckoutCartFromLinked(svc, getMeta, fetchLinkedStoreCart);
    const cart = svc.getCart();
    if (!cart.lines.length) {
      return nativeTurn(NATIVE_COMMERCE_LEAD.payNeedItems, "cart_view");
    }
    return continueTowardCheckout(payArgs);
  }

  if (deskCmd?.kind === "set_qty") {
    const cart = await svc.cartUpdate(deskCmd.productId, deskCmd.quantity);
    if (!cart.lines.length) {
      return nativeTurn(NATIVE_COMMERCE_LEAD.cartEmptied, "cart_view");
    }
    return nativeTurn(
      appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartUpdated, cart),
      "cart_view",
    );
  }

  if (deskCmd?.kind === "add") {
    const row = await getPublishedProduct(db, orgId, deskCmd.productId);
    if (!row) {
      return nativeTurn(NATIVE_COMMERCE_LEAD.productUnavailable, "faq");
    }
    if (deskCmd.quantity == null) {
      return startPickQuantity({ db, orgId, row, setMeta, svc });
    }
    clearUx();
    return addProductWithQuantity({
      db,
      orgId,
      row,
      quantity: deskCmd.quantity,
      setMeta,
      svc,
    });
  }

  if (deskCmd?.kind === "view_product") {
    const row = await getPublishedProduct(db, orgId, deskCmd.productId);
    if (!row) {
      return nativeTurn(NATIVE_COMMERCE_LEAD.productUnavailable, "faq");
    }
    return nativeTurn(
      buildProductDetailDeskUi(row, svc.getCart(), null),
      "product_detail",
      { actionProductId: row.id },
    );
  }

  return null;
}
