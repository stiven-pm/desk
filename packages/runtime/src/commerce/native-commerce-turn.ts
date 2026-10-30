import type { CommerceBuyer, CommerceCart } from "@chatbot/domain";
import {
  COMMERCE_VISITOR_LABEL,
  missingCommerceBuyerFields,
  NATIVE_COMMERCE_LEAD,
  nativeBuyerFieldPrompt,
  nativeCartAddFailed,
  nativeLineNotesPrompt,
  nativePriceChangedLead,
  parseInternalDeskCommand,
  resolveNativeCheckoutFailure,
  validateCommerceBuyerField,
} from "@chatbot/domain";
import { DESK_UI_FENCE } from "@chatbot/chat-ui";
import type { CommerceService } from "./commerce-service";
import { parseCart } from "./cart-store";
import {
  appendCartDeskUiFence,
  appendPostCartChoicesDeskUi,
  buildBuyerConsentDeskUi,
  buildInvalidQuantityReply,
  buildProductDetailDeskUi,
  buildQuantityPickerDeskUi,
  DESK_CMD_CONFIRM_PRICE,
  formatMoneyCents,
} from "./commerce-ui";
import {
  getPublishedProduct,
  searchPublishedProducts,
  type NativeProductRow,
} from "./native-catalog";
import { reservedQtyForProduct } from "./stock-reservations";
import {
  buildNoStockVisitorReply,
} from "./stock-availability";
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

function checkoutFailureMessage(
  checkout: { code?: string; subtotalCents?: number; currency?: string },
  cartCurrency: string,
): string {
  const resolved = resolveNativeCheckoutFailure({
    code: checkout.code,
    subtotalCents: checkout.subtotalCents,
    currency: checkout.currency,
    cartCurrency,
    formatMoney: formatMoneyCents,
  });
  if (resolved.type === "buyer_consent") {
    return buildBuyerConsentDeskUi();
  }
  if (resolved.type === "price_confirm") {
    const choices = {
      type: "choices",
      items: [
        {
          label: COMMERCE_VISITOR_LABEL.confirmPriceButton,
          message: DESK_CMD_CONFIRM_PRICE,
        },
      ],
    };
    return `${nativePriceChangedLead(resolved.totalFormatted)}\n\`\`\`${DESK_UI_FENCE}\n${JSON.stringify({ blocks: [choices] })}\n\`\`\``;
  }
  return resolved.message;
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
    return {
      assistantText: buildNoStockVisitorReply({
        row: args.row,
        maxAdd,
        reservedOthers,
      }),
    };
  }
  args.setMeta(
    META_COMMERCE_UX,
    JSON.stringify({ mode: "pick_qty", productId: args.row.id }),
  );
  return {
    assistantText: buildQuantityPickerDeskUi(args.row, maxAdd),
  };
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
    return { assistantText: valid.message };
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
    return {
      assistantText: nativeLineNotesPrompt(row.name),
    };
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
      return {
        assistantText: again.ok
          ? NATIVE_COMMERCE_LEAD.insufficientStock
          : again.message,
      };
    }
    return {
      assistantText: nativeCartAddFailed(added.code),
    };
  }
  return {
    assistantText: appendPostCartChoicesDeskUi(
      appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartAddSuccess, added.cart),
      added.cart,
    ),
  };
}

export type NativeCommerceTurnResult = {
  assistantText: string;
  checkoutUrl?: string;
  commerceCode?: string;
};

async function runCheckout(
  svc: CommerceService,
  opts?: {
    confirmPriceChange?: boolean;
    confirmCartChange?: boolean;
    turnstileToken?: string;
  },
): Promise<NativeCommerceTurnResult> {
  const checkout = await svc.startCheckout({
    confirmPriceChange: opts?.confirmPriceChange,
    confirmCartChange: opts?.confirmCartChange,
    turnstileToken: opts?.turnstileToken,
  });
  if (!checkout.ok) {
    return {
      assistantText: checkoutFailureMessage(checkout, svc.getCart().currency),
      commerceCode: checkout.code,
    };
  }
  return {
    assistantText: NATIVE_COMMERCE_LEAD.checkoutLink,
    checkoutUrl: checkout.checkoutUrl,
  };
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
}): Promise<NativeCommerceTurnResult | null> {
  const { db, orgId, text, getMeta, setMeta, svc, fetchLinkedStoreCart, turnstileToken } =
    args;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const clearUx = () => setMeta(META_COMMERCE_UX, "");
  const ux = parseUx(getMeta(META_COMMERCE_UX));

  const deskCmd = parseInternalDeskCommand(trimmed);

  if (deskCmd?.kind === "consent") {
    await svc.recordBuyerConsentAsync();
    const next = await nextBuyerField(svc, svc.getBuyer());
    if (next) {
      setMeta(META_COMMERCE_UX, JSON.stringify({ mode: "buyer", field: next }));
      return { assistantText: buyerPrompt(next) };
    }
    return await runCheckout(svc, { turnstileToken });
  }

  if (deskCmd?.kind === "confirm_price") {
    await ensureCheckoutCartFromLinked(svc, getMeta, fetchLinkedStoreCart);
    return await runCheckout(svc, {
      confirmPriceChange: true,
      confirmCartChange: true,
      turnstileToken,
    });
  }

  if (ux?.mode === "pick_qty") {
    const row = await getPublishedProduct(db, orgId, ux.productId);
    if (!row) {
      clearUx();
      return { assistantText: NATIVE_COMMERCE_LEAD.productUnavailable };
    }
    const { reservedOthers, maxAdd } = await stockLimitsForAdd(
      db,
      orgId,
      svc,
      row,
    );
    const qty = parsePickQtyReply(trimmed, ux.productId);
    if (qty == null) {
      return { assistantText: buildInvalidQuantityReply(row, maxAdd) };
    }
    const valid = validateAddQuantityForRow(
      row,
      qty,
      svc.getCart(),
      reservedOthers,
    );
    if (!valid.ok) {
      return { assistantText: valid.message };
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
        return {
          assistantText: NATIVE_COMMERCE_LEAD.insufficientStockWithNotes,
        };
      }
      return {
        assistantText: nativeCartAddFailed(added.code),
      };
    }
    return {
      assistantText: appendPostCartChoicesDeskUi(
        appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartAddSuccess, added.cart),
        added.cart,
      ),
    };
  }

  if (ux?.mode === "buyer") {
    const prev = svc.getBuyer() ?? { type: "natural_person" as const };
    const field = ux.field;
    const checked = validateCommerceBuyerField(String(field), trimmed);
    if (!checked.ok) {
      return { assistantText: checked.message };
    }
    const buyer: CommerceBuyer = {
      ...prev,
      type: "natural_person",
      [field]: checked.value,
    };
    await svc.persistBuyer(buyer);
    const next = await nextBuyerField(svc, buyer);
    if (next) {
      setMeta(META_COMMERCE_UX, JSON.stringify({ mode: "buyer", field: next }));
      return { assistantText: buyerPrompt(next) };
    }
    clearUx();
    return await runCheckout(svc, { turnstileToken });
  }

  if (deskCmd?.kind === "menu") {
    clearUx();
    const rows = await searchPublishedProducts(db, orgId, "", 24);
    if (!rows.length) {
      return { assistantText: NATIVE_COMMERCE_LEAD.catalogEmpty };
    }
    const cart = cartForCommands(svc);
    let assistantText = buildProductCatalogPickerDeskUi(
      rows,
      COMMERCE_VISITOR_LABEL.catalogModalButton,
    );
    if (cart.lines.length) {
      assistantText = appendPostCartChoicesDeskUi(assistantText, cart);
    }
    return { assistantText };
  }

  if (deskCmd?.kind === "cart") {
    const cart = cartForCommands(svc);
    if (!cart.lines.length) {
      return {
        assistantText: appendPostCartChoicesDeskUi(
          NATIVE_COMMERCE_LEAD.cartEmpty,
          cart,
          "empty",
        ),
      };
    }
    return {
      assistantText: appendPostCartChoicesDeskUi(
        appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartShow, cart),
        cart,
        "cart_view",
      ),
    };
  }

  if (deskCmd?.kind === "pay") {
    await ensureCheckoutCartFromLinked(svc, getMeta, fetchLinkedStoreCart);
    const cart = svc.getCart();
    if (!cart.lines.length) {
      return { assistantText: NATIVE_COMMERCE_LEAD.payNeedItems };
    }
    if (!svc.hasBuyerConsent()) {
      return { assistantText: buildBuyerConsentDeskUi() };
    }
    const next = await nextBuyerField(svc, svc.getBuyer());
    if (next) {
      setMeta(META_COMMERCE_UX, JSON.stringify({ mode: "buyer", field: next }));
      return { assistantText: buyerPrompt(next) };
    }
    const checkoutResult = await runCheckout(svc, { turnstileToken });
    if (checkoutResult.checkoutUrl) {
      checkoutResult.assistantText = NATIVE_COMMERCE_LEAD.payLink;
    }
    return checkoutResult;
  }

  if (deskCmd?.kind === "set_qty") {
    const cart = await svc.cartUpdate(deskCmd.productId, deskCmd.quantity);
    if (!cart.lines.length) {
      return {
        assistantText: appendPostCartChoicesDeskUi(
          NATIVE_COMMERCE_LEAD.cartEmptied,
          cart,
          "empty",
        ),
      };
    }
    return {
      assistantText: appendPostCartChoicesDeskUi(
        appendCartDeskUiFence(NATIVE_COMMERCE_LEAD.cartUpdated, cart),
        cart,
        "cart_view",
      ),
    };
  }

  if (deskCmd?.kind === "add") {
    const row = await getPublishedProduct(db, orgId, deskCmd.productId);
    if (!row) {
      return { assistantText: NATIVE_COMMERCE_LEAD.productUnavailable };
    }
    if (deskCmd.quantity == null) {
      if (Number(row.allows_additions) === 1) {
        const { maxAdd } = await stockLimitsForAdd(db, orgId, svc, row);
        if (maxAdd < 1) {
          return {
            assistantText: await noStockVisitorReply(db, orgId, svc, row),
          };
        }
        clearUx();
        setMeta(
          META_COMMERCE_UX,
          JSON.stringify({
            mode: "line_notes",
            productId: row.id,
            quantity: 1,
          }),
        );
        return {
          assistantText: nativeLineNotesPrompt(chatCatalogTitle(row)),
        };
      }
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
      return { assistantText: NATIVE_COMMERCE_LEAD.productUnavailable };
    }
    return {
      assistantText: buildProductDetailDeskUi(row, svc.getCart(), null),
    };
  }

  return null;
}
