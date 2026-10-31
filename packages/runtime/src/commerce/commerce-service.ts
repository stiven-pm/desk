import {
  buyerFieldsForType,
  missingCommerceBuyerFields,
  parseCommerceManifest,
  type CommerceBuyer,
  type CommerceBuyerType,
  type CommerceCart,
  type CommerceCartLine,
  type OrderFulfillment,
  type OrderFulfillmentMode,
} from "@chatbot/domain";
import type { CatalogPriceEntry } from "./catalog-price";
import { formatPublicOrderRef, formatPublicAccessToken } from "./order-ref";
import {
  getPublishedProduct,
  nativeProductToCatalogEntry,
  searchPublishedProducts,
  type NativeProductRow,
} from "./native-catalog";
import { COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT } from "./catalog-search";
import {
  cartFingerprint,
  rebuildCartFromCatalog,
} from "./rebuild-cart-from-catalog";
import {
  clearStockReservationsForConversation,
  reservedQtyForProduct,
  syncStockReservationsForCart,
} from "./stock-reservations";
import { maxAddQuantityForRow } from "./visitor-quantity";
import { verifyTurnstileToken } from "./turnstile";
import {
  addLine,
  cartSubtotalCents,
  emptyCart,
  META_BUYER,
  META_CART,
  META_CATALOG_PRICES,
  META_CHECKOUT_PENDING,
  META_LAST_ORDER,
  META_BUYER_CONSENT,
  META_BUYER_CONSENT_POLICY,
  META_LINKED_STORE_CONVERSATION,
  META_LINKED_STORE_CART,
  META_SOURCE_CHANNEL,
  parseBuyer,
  parseCart,
  updateLineQty,
} from "./cart-store";
import {
  createProviderCheckoutUrl,
  loadActivePaymentProvider,
} from "./org-payment-provider";
import {
  mirrorLinkedStoreStateToMeta,
  refreshLinkedStoreMirror,
  type LinkedStoreCommerceProxy,
} from "./linked-store-commerce";
import {
  executeIntegrationCapability,
  findOperation,
  loadOrgCommerceCatalogBundle,
  loadOrgIntegrationBundle,
  mapCatalogItems,
} from "../integrations/integration-runtime";

export type CartAddResult =
  | { ok: true; cart: CommerceCart }
  | { ok: false; code: string; hint?: string; productId?: string };

type MetaStore = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export type CatalogPriceResolver = {
  resolvePrice: (
    productId: string,
  ) => Promise<CatalogPriceEntry | null> | CatalogPriceEntry | null;
};

export type CommerceServiceDeps = {
  meta: MetaStore;
  db?: D1Database;
  orgId: string;
  botId: string;
  conversationId: string;
  /** Bot tiene herramientas HTTP de catálogo: el carrito no acepta precios inventados por el modelo. */
  hasCatalogHttpTools?: boolean;
  hasNativeCatalog?: boolean;
  catalogPriceResolver?: CatalogPriceResolver;
  orderPageBaseUrl?: string;
  platformApiUrl?: string;
  encryptionKey?: string;
  onPaymentEvidenceSubmitted?: (orderId: string) => void | Promise<void>;
  trackEvent?: (name: string, meta: Record<string, unknown>) => void;
  turnstileSecret?: string;
  /** When `production`, checkout requires Turnstile secret to be set. */
  checkoutEnv?: string;
  /** Chat DO linked to a hosted store session: cart/buyer/checkout go to the store DO. */
  linkedStore?: LinkedStoreCommerceProxy;
};

export type CommerceCatalogSearchResult = {
  products: NativeProductRow[];
  noMatch?: boolean;
  relaxed?: boolean;
};

export class CommerceService {
  constructor(private deps: CommerceServiceDeps) {}

  getCart(): CommerceCart {
    if (this.deps.linkedStore) {
      return parseCart(this.deps.meta.get(META_LINKED_STORE_CART));
    }
    return parseCart(this.deps.meta.get(META_CART));
  }

  usesLinkedStoreCart(): boolean {
    return Boolean(this.deps.linkedStore);
  }

  getConversationId(): string {
    return this.deps.conversationId;
  }

  async pullLinkedStoreMirror(): Promise<CommerceCart | null> {
    if (!this.deps.linkedStore) return null;
    return refreshLinkedStoreMirror(this.deps.linkedStore, this.deps.meta);
  }

  setCart(cart: CommerceCart): void {
    this.deps.meta.set(META_CART, JSON.stringify(cart));
  }

  private async persistCartWithReservations(cart: CommerceCart): Promise<void> {
    this.setCart(cart);
    if (!this.deps.db || !this.deps.hasNativeCatalog) return;
    if (!cart.lines.length) {
      await clearStockReservationsForConversation(
        this.deps.db,
        this.deps.orgId,
        this.deps.conversationId,
      );
    }
  }

  getBuyer(): CommerceBuyer | null {
    return parseBuyer(this.deps.meta.get(META_BUYER));
  }

  setBuyer(buyer: CommerceBuyer): void {
    this.deps.meta.set(META_BUYER, JSON.stringify(buyer));
  }

  recordBuyerConsent(): void {
    this.deps.meta.set(META_BUYER_CONSENT, new Date().toISOString());
    this.deps.meta.set(META_BUYER_CONSENT_POLICY, "desk-ley1581-v1");
  }

  async recordBuyerConsentAsync(): Promise<void> {
    if (!this.deps.linkedStore) {
      this.recordBuyerConsent();
      return;
    }
    const buyer = this.getBuyer() ?? { type: "natural_person" as const };
    await this.persistBuyer(buyer, { recordConsent: true });
  }

  async persistBuyer(
    buyer: CommerceBuyer,
    opts?: { recordConsent?: boolean },
  ): Promise<void> {
    if (!this.deps.linkedStore) {
      this.setBuyer(buyer);
      if (opts?.recordConsent) this.recordBuyerConsent();
      return;
    }
    const prev = this.getBuyer() ?? { type: "natural_person" as const };
    const payload = {
      ...prev,
      ...buyer,
      ...(opts?.recordConsent ? { consentAccepted: true } : {}),
    };
    const res = await this.deps.linkedStore.fetchStore("/commerce/buyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      buyer?: CommerceBuyer;
      buyerConsentAt?: string | null;
      cart?: CommerceCart;
    };
    mirrorLinkedStoreStateToMeta(this.deps.meta, {
      buyer: data.buyer ?? buyer,
      buyerConsentAt: data.buyerConsentAt ?? null,
      cart: data.cart ?? null,
    });
    if (!res.ok) {
      throw new Error("linked_buyer_save_failed");
    }
  }

  hasBuyerConsent(): boolean {
    return Boolean(this.deps.meta.get(META_BUYER_CONSENT)?.trim());
  }

  getBuyerConsentAt(): string | null {
    return this.deps.meta.get(META_BUYER_CONSENT)?.trim() || null;
  }

  async loadManifest() {
    if (!this.deps.db) return parseCommerceManifest(null);
    const row = await this.deps.db
      .prepare(`SELECT manifest_json, mode FROM org_commerce_config WHERE org_id = ?`)
      .bind(this.deps.orgId)
      .first<{ manifest_json: string | null; mode: string }>();
    if (!row) return parseCommerceManifest(null);
    const m = parseCommerceManifest(row.manifest_json);
    if (row.mode === "checkout_link") m.mode = "checkout_link";
    return m;
  }

  recordCatalogPrices(entries: CatalogPriceEntry[]): void {
    if (!entries.length) return;
    const map = this.getCatalogPriceCache();
    for (const e of entries) {
      map[e.productId] = e;
    }
    this.deps.meta.set(META_CATALOG_PRICES, JSON.stringify(map));
  }

  getCatalogPriceCache(): Record<string, CatalogPriceEntry> {
    const raw = this.deps.meta.get(META_CATALOG_PRICES);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, CatalogPriceEntry>;
    } catch {
      return {};
    }
  }

  clearCatalogPriceCache(): void {
    this.deps.meta.set(META_CATALOG_PRICES, "{}");
  }

  async cartAdd(args: {
    productId: string;
    name: string;
    priceCents?: number;
    quantity?: number;
    currency?: string;
    imageUrl?: string;
    lineNotes?: string;
  }): Promise<CartAddResult> {
    if (this.deps.linkedStore) {
      const res = await this.deps.linkedStore.fetchStore("/commerce/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: args.productId,
          name: args.name,
          priceCents: args.priceCents,
          quantity: args.quantity,
          currency: args.currency,
          imageUrl: args.imageUrl,
          lineNotes: args.lineNotes,
        }),
      });
      const data = (await res.json()) as CartAddResult & {
        cart?: CommerceCart;
        buyer?: CommerceBuyer | null;
        buyerConsentAt?: string | null;
      };
      if (data.cart) {
        mirrorLinkedStoreStateToMeta(this.deps.meta, {
          cart: data.cart,
          buyer: data.buyer ?? undefined,
          buyerConsentAt: data.buyerConsentAt ?? undefined,
        });
      }
      if (!res.ok) {
        return data.ok === false
          ? data
          : { ok: false, code: (data as { code?: string }).code ?? "cart_add_failed" };
      }
      return { ok: true, cart: data.cart! };
    }

    const productId = String(args.productId).slice(0, 64);
    if (!productId) {
      return { ok: false, code: "product_id_required" };
    }

    let priceCents: number | null = null;
    let name = String(args.name ?? "").slice(0, 200);

    const requiresAuthorizedPrice =
      this.deps.hasCatalogHttpTools || this.deps.hasNativeCatalog;

    if (requiresAuthorizedPrice) {
      const cached = this.getCatalogPriceCache()[productId];
      const resolved =
        cached ??
        (await Promise.resolve(
          this.deps.catalogPriceResolver?.resolvePrice(productId) ?? null,
        ));
      if (!resolved) {
        return {
          ok: false,
          code: "price_must_come_from_catalog_tool",
          hint:
            "Usa commerce_search_products o la herramienta de catálogo conectada antes de commerce_cart_add.",
        };
      }
      priceCents = resolved.priceCents;
      if (!name && resolved.name) name = resolved.name;
      if (resolved.name && !args.name) name = resolved.name;
    } else if (args.priceCents != null && Number.isFinite(args.priceCents)) {
      priceCents = Math.max(0, Math.round(args.priceCents));
      void this.trackCommerceEvent("cart.price_from_llm", {
        productId,
        priceCents,
      });
    }

    if (priceCents == null || !name) {
      return { ok: false, code: "price_and_name_required" };
    }

    const lineNotes = args.lineNotes?.trim().slice(0, 400) || undefined;

    if (this.deps.db && this.deps.hasNativeCatalog) {
      const row = await getPublishedProduct(
        this.deps.db,
        this.deps.orgId,
        productId,
      );
      if (row && Number(row.allows_additions) === 1 && !lineNotes) {
        return { ok: false, code: "line_notes_required" };
      }
      if (row?.stock_qty != null) {
        const cartBefore = this.getCart();
        const addQty = Math.min(99, Math.max(1, args.quantity ?? 1));
        const reservedOthers = await reservedQtyForProduct(
          this.deps.db,
          this.deps.orgId,
          productId,
          this.deps.conversationId,
        );
        const maxAdd = maxAddQuantityForRow(
          row,
          cartBefore,
          reservedOthers,
          lineNotes,
        );
        if (addQty > maxAdd) {
          return { ok: false, code: "insufficient_stock", productId };
        }
      }
    }

    const cart = addLine(this.getCart(), {
      productId,
      name,
      priceCents,
      quantity: Math.min(99, Math.max(1, args.quantity ?? 1)),
      currency: (args.currency ?? this.getCart().currency).slice(0, 8),
      imageUrl: args.imageUrl,
      lineNotes,
    });
    await this.persistCartWithReservations(cart);
    this.deps.trackEvent?.("cart.updated", { lines: cart.lines.length });
    return { ok: true, cart };
  }

  async cartUpdate(productId: string, quantity: number): Promise<CommerceCart> {
    if (this.deps.linkedStore) {
      const res = await this.deps.linkedStore.fetchStore("/commerce/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          productId,
          quantity,
        }),
      });
      const data = (await res.json()) as {
        cart?: CommerceCart;
        code?: string;
      };
      if (!res.ok || !data.cart) {
        return this.getCart();
      }
      mirrorLinkedStoreStateToMeta(this.deps.meta, { cart: data.cart });
      return data.cart;
    }
    const cart = updateLineQty(this.getCart(), productId, quantity);
    await this.persistCartWithReservations(cart);
    return cart;
  }

  validateBuyer(
    buyer: CommerceBuyer,
    manifest?: Awaited<ReturnType<CommerceService["loadManifest"]>>,
  ): { ok: true } | { ok: false; missing: string[] } {
    const missing = missingCommerceBuyerFields(buyer, manifest ?? null);
    return missing.length ? { ok: false, missing } : { ok: true };
  }

  async buyerFieldOrder(
    type: CommerceBuyerType = "natural_person",
  ): Promise<(keyof CommerceBuyer)[]> {
    const manifest = await this.loadManifest();
    return buyerFieldsForType(type, manifest) as (keyof CommerceBuyer)[];
  }

  private async conversationIdsForCheckout(): Promise<string[]> {
    const ids = [this.deps.conversationId];
    const linked = this.deps.meta.get(META_LINKED_STORE_CONVERSATION)?.trim();
    if (linked && linked !== this.deps.conversationId) ids.push(linked);
    return ids;
  }

  private async findAwaitingPaymentOnLinkedConversations(): Promise<{
    orderId: string;
    conversationId: string;
  } | null> {
    if (!this.deps.db) return null;
    const ids = await this.conversationIdsForCheckout();
    if (!ids.length) return null;
    const placeholders = ids.map(() => "?").join(",");
    const row = await this.deps.db
      .prepare(
        `SELECT id, conversation_id FROM sales_orders
         WHERE org_id = ? AND status = 'awaiting_payment'
           AND conversation_id IN (${placeholders})
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(this.deps.orgId, ...ids)
      .first<{ id: string; conversation_id: string }>();
    if (!row) return null;
    return { orderId: row.id, conversationId: row.conversation_id };
  }

  async searchProducts(args: {
    integrationQuery: string;
    nativeQuery: string;
    limit?: number;
  }): Promise<CommerceCatalogSearchResult> {
    if (!this.deps.db) return { products: [] };
    const limit = Math.min(
      COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT,
      Math.max(1, args.limit ?? COMMERCE_SEARCH_TOOL_DEFAULT_LIMIT),
    );
    const integrationQ = args.integrationQuery.trim();
    const external = await this.searchExternalCatalog(integrationQ, limit);
    if (external) {
      const noMatch =
        integrationQ.length > 0 && external.length === 0;
      return { products: external, ...(noMatch ? { noMatch: true } : {}) };
    }
    const { rows, relaxed } = await searchPublishedProducts(
      this.deps.db,
      this.deps.orgId,
      args.nativeQuery,
      limit,
    );
    for (const row of rows) {
      this.recordCatalogPrices([nativeProductToCatalogEntry(row)]);
    }
    const nativeTerms = args.nativeQuery.trim();
    const noMatch = nativeTerms.length > 0 && rows.length === 0;
    return {
      products: rows,
      ...(noMatch ? { noMatch: true } : {}),
      ...(relaxed ? { relaxed: true } : {}),
    };
  }

  async getProductDetails(productId: string): Promise<NativeProductRow | null> {
    if (!this.deps.db) return null;
    const bundle = await loadOrgCommerceCatalogBundle(
      this.deps.db,
      this.deps.orgId,
      this.deps.encryptionKey,
    );
    if (bundle) {
      const result = await executeIntegrationCapability(
        bundle,
        "catalog.get",
        { productId, query: productId },
      );
      if (result.ok) {
        const mapped = result.mapped;
        const row: NativeProductRow = {
          id: String(mapped.productId ?? productId),
          name: String(mapped.name ?? ""),
          description: mapped.description
            ? String(mapped.description)
            : null,
          price_cents: Number(mapped.priceCents ?? 0),
          compare_at_price_cents: null,
          promo_label: null,
          currency: String(mapped.currency ?? "COP"),
          image_url: null,
          stock_qty:
            typeof mapped.stock === "number" ? mapped.stock : null,
          allows_additions: 0,
          category: null,
          featured: 0,
        };
        if (row.name) {
          this.recordCatalogPrices([nativeProductToCatalogEntry(row)]);
          return row;
        }
      }
    }
    const row = await getPublishedProduct(
      this.deps.db,
      this.deps.orgId,
      productId,
    );
    if (row) {
      this.recordCatalogPrices([nativeProductToCatalogEntry(row)]);
    }
    return row;
  }

  private async searchExternalCatalog(
    query: string,
    limit: number,
  ): Promise<NativeProductRow[] | null> {
    if (!this.deps.db) return null;
    const bundle = await loadOrgCommerceCatalogBundle(
      this.deps.db,
      this.deps.orgId,
      this.deps.encryptionKey,
    );
    if (!bundle || !findOperation(bundle, "catalog.search")) return null;
    const result = await executeIntegrationCapability(
      bundle,
      "catalog.search",
      { query, limit: String(limit) },
    );
    if (!result.ok) return null;
    const op = findOperation(bundle, "catalog.search");
    if (!op) return null;
    const items = mapCatalogItems(result.bodyJson, op);
    const rows: NativeProductRow[] = items.map((p) => ({
      id: p.productId,
      name: p.name,
      description: null,
      price_cents: p.priceCents,
      compare_at_price_cents: null,
      promo_label: null,
      currency: p.currency,
      image_url: null,
      stock_qty: p.stock ?? null,
      allows_additions: 0,
      category: null,
      featured: 0,
    }));
    this.recordCatalogPrices(
      items.map((p) => ({
        productId: p.productId,
        priceCents: p.priceCents,
        name: p.name,
      })),
    );
    return rows;
  }

  getPaymentInstructionsText(): string {
    return this.cachedPaymentInstructions ?? "";
  }

  private cachedPaymentInstructions = "";

  async loadPaymentInstructionsForPrompt(): Promise<string> {
    const manifest = await this.loadManifest();
    const p = manifest.paymentInstructions;
    if (!p) {
      this.cachedPaymentInstructions = "";
      return "";
    }
    const lines: string[] = [];
    if (p.bankName) lines.push(`Banco: ${p.bankName}`);
    if (p.accountHolder) lines.push(`Titular: ${p.accountHolder}`);
    if (p.accountType) lines.push(`Tipo: ${p.accountType}`);
    if (p.accountNumber) lines.push(`Cuenta: ${p.accountNumber}`);
    if (p.paymentLink) lines.push(`Enlace de pago: ${p.paymentLink}`);
    if (p.notes) lines.push(p.notes);
    this.cachedPaymentInstructions = lines.join("\n");
    return this.cachedPaymentInstructions;
  }

  async submitOrder(): Promise<
    | {
        ok: true;
        orderId: string;
        publicRef?: string;
        publicAccessToken?: string;
        orderPageUrl?: string;
        summary: string;
      }
    | { ok: false; code: string; missing?: string[]; productId?: string }
  > {
    const rawCart = this.getCart();
    if (!rawCart.lines.length) {
      return { ok: false, code: "cart_empty" };
    }

    const rebuilt = await rebuildCartFromCatalog({
      cart: rawCart,
      db: this.deps.db,
      orgId: this.deps.orgId,
      hasNativeCatalog: Boolean(this.deps.hasNativeCatalog),
      conversationId: this.deps.conversationId,
    });
    if (!rebuilt.ok) {
      return rebuilt;
    }
    this.setCart(rebuilt.cart);
    await this.persistCartWithReservations(rebuilt.cart);
    const cart = rebuilt.cart;

    const buyer = this.getBuyer();
    if (!buyer) {
      return { ok: false, code: "buyer_required" };
    }
    const manifest = await this.loadManifest();
    const valid = this.validateBuyer(buyer, manifest);
    if (!valid.ok) {
      return { ok: false, code: "buyer_incomplete", missing: valid.missing };
    }
    if (!this.hasBuyerConsent()) {
      return { ok: false, code: "buyer_consent_required" };
    }
    if (!this.deps.db) {
      return { ok: false, code: "storage_unavailable" };
    }

    if (this.deps.hasNativeCatalog) {
      for (const line of cart.lines) {
        const row = await getPublishedProduct(
          this.deps.db,
          this.deps.orgId,
          line.productId,
        );
        if (!row || row.stock_qty == null) continue;
        const reserved = await reservedQtyForProduct(
          this.deps.db,
          this.deps.orgId,
          line.productId,
          this.deps.conversationId,
        );
        const available = Math.max(0, row.stock_qty - reserved);
        if (line.quantity > available) {
          return {
            ok: false,
            code: "insufficient_stock",
            productId: line.productId,
          };
        }
      }
    }

    const orderId = crypto.randomUUID();
    const subtotal = cartSubtotalCents(cart);
    const summary = cart.lines
      .map((l) => `${l.name} x${l.quantity}`)
      .join(", ")
      .slice(0, 500);

    const gatewayOnly = manifest.commerceProfile !== "support_only";
    const initialStatus = gatewayOnly ? "awaiting_payment" : "pending_fulfillment";
    const publicRef = gatewayOnly ? await this.allocatePublicRef() : null;
    const publicAccessToken = await this.allocatePublicAccessToken();
    const fp = cartFingerprint(cart);
    const sourceChannel =
      this.deps.meta.get(META_SOURCE_CHANNEL)?.trim() || "web";
    const linkedStore =
      this.deps.meta.get(META_LINKED_STORE_CONVERSATION)?.trim() || null;

    await this.deps.db
      .prepare(
        `INSERT INTO sales_orders (id, org_id, bot_id, conversation_id, status, buyer_type, buyer_json, currency, subtotal_cents, lines_json, summary, public_ref, public_access_token, source_channel, linked_store_conversation_id, cart_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        this.deps.orgId,
        this.deps.botId,
        this.deps.conversationId,
        initialStatus,
        buyer.type,
        JSON.stringify(buyer),
        cart.currency,
        subtotal,
        JSON.stringify(cart.lines),
        summary,
        publicRef,
        publicAccessToken,
        sourceChannel,
        linkedStore,
        fp,
      )
      .run();

    await this.deps.db
      .prepare(
        `INSERT OR IGNORE INTO human_queue (id, org_id, conversation_id, status, summary)
         VALUES (?, ?, ?, 'open', ?)`,
      )
      .bind(crypto.randomUUID(), this.deps.orgId, this.deps.conversationId, `Pedido ${orderId}: ${summary}`)
      .run();

    await this.trackCommerceEvent("order.created", {
      orderId,
      subtotalCents: subtotal,
      currency: cart.currency,
    });

    this.deps.meta.set(META_LAST_ORDER, orderId);
    await this.persistCartWithReservations(emptyCart(cart.currency));
    await clearStockReservationsForConversation(
      this.deps.db,
      this.deps.orgId,
      this.deps.conversationId,
    );

    const base =
      manifest.orderPageBaseUrl?.replace(/\/$/, "") ??
      this.deps.orderPageBaseUrl?.replace(/\/$/, "") ??
      "";
    const orderPageUrl =
      publicAccessToken && base
        ? `${base}/o/${encodeURIComponent(publicAccessToken)}`
        : undefined;

    let summaryText = `Pedido ${publicRef ?? orderId.slice(0, 8)} registrado. ${summary}. Total: ${subtotal / 100} ${cart.currency}.`;
    if (gatewayOnly) {
      summaryText += " Usa el enlace de pago de la pasarela para completar la compra.";
    }

    return {
      ok: true,
      orderId,
      publicRef: publicRef ?? undefined,
      publicAccessToken,
      orderPageUrl,
      summary: summaryText,
    };
  }

  async submitPaymentEvidence(args: {
    orderId?: string;
    reference?: string;
    notes?: string;
  }): Promise<{ ok: true } | { ok: false; code: string }> {
    if (!this.deps.db) return { ok: false, code: "storage_unavailable" };
    const orderId =
      args.orderId?.trim() ||
      this.deps.meta.get(META_LAST_ORDER) ||
      "";
    if (!orderId) return { ok: false, code: "order_not_found" };

    const row = await this.deps.db
      .prepare(
        `SELECT id, status FROM sales_orders WHERE id = ? AND org_id = ?`,
      )
      .bind(orderId, this.deps.orgId)
      .first<{ id: string; status: string }>();
    if (!row) return { ok: false, code: "order_not_found" };
    if (!["awaiting_payment", "created"].includes(row.status)) {
      return { ok: false, code: "invalid_order_state" };
    }

    const meta = {
      reference: args.reference?.slice(0, 120) ?? null,
      notes: args.notes?.slice(0, 500) ?? null,
      reportedAt: new Date().toISOString(),
    };

    await this.deps.db
      .prepare(
        `UPDATE sales_orders SET status = 'pending_verification',
         payment_evidence_meta_json = ?, updated_at = datetime('now')
         WHERE id = ? AND org_id = ?`,
      )
      .bind(JSON.stringify(meta), orderId, this.deps.orgId)
      .run();

    await this.trackCommerceEvent("payment.evidence_submitted", {
      orderId,
      ...meta,
    });

    void this.deps.onPaymentEvidenceSubmitted?.(orderId);

    return { ok: true };
  }

  private async allocatePublicAccessToken(): Promise<string> {
    if (!this.deps.db) return formatPublicAccessToken();
    for (let i = 0; i < 8; i++) {
      const token = formatPublicAccessToken();
      const clash = await this.deps.db
        .prepare(`SELECT id FROM sales_orders WHERE public_access_token = ?`)
        .bind(token)
        .first();
      if (!clash) return token;
    }
    return formatPublicAccessToken();
  }

  private async allocatePublicRef(): Promise<string> {
    if (!this.deps.db) return formatPublicOrderRef();
    for (let i = 0; i < 8; i++) {
      const ref = formatPublicOrderRef();
      const clash = await this.deps.db
        .prepare(`SELECT id FROM sales_orders WHERE public_ref = ?`)
        .bind(ref)
        .first();
      if (!clash) return ref;
    }
    return `RK-${crypto.randomUUID().slice(0, 8)}`;
  }

  async startCheckout(opts?: {
    idempotencyKey?: string;
    confirmPriceChange?: boolean;
    confirmCartChange?: boolean;
    turnstileToken?: string;
  }): Promise<
    | {
        ok: true;
        paymentId: string;
        checkoutUrl: string;
        orderId: string;
        publicRef?: string;
        reused?: boolean;
      }
    | {
        ok: false;
        code: string;
        missing?: string[];
        productId?: string;
        subtotalCents?: number;
        currency?: string;
      }
  > {
    if (this.deps.linkedStore) {
      await this.pullLinkedStoreMirror();
      const res = await this.deps.linkedStore.fetchStore("/commerce/start-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: opts?.idempotencyKey,
          confirmPriceChange: opts?.confirmPriceChange,
          confirmCartChange: opts?.confirmCartChange,
          turnstileToken: opts?.turnstileToken,
        }),
      });
      const result = (await res.json()) as Awaited<
        ReturnType<CommerceService["startCheckout"]>
      >;
      await this.pullLinkedStoreMirror();
      return result;
    }

    if (!this.deps.db) return { ok: false, code: "storage_unavailable" };

    const rawCart = this.getCart();
    const rebuilt = await rebuildCartFromCatalog({
      cart: rawCart,
      db: this.deps.db,
      orgId: this.deps.orgId,
      hasNativeCatalog: Boolean(this.deps.hasNativeCatalog),
      conversationId: this.deps.conversationId,
    });
    if (!rebuilt.ok) return rebuilt;
    this.setCart(rebuilt.cart);
    if (rebuilt.cart.lines.length > 0) {
      await syncStockReservationsForCart({
        db: this.deps.db,
        orgId: this.deps.orgId,
        conversationId: this.deps.conversationId,
        lines: rebuilt.cart.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      });
    }
    const fp = cartFingerprint(rebuilt.cart);

    if (rebuilt.priceChanged && !opts?.confirmPriceChange) {
      return {
        ok: false,
        code: "price_changed",
        subtotalCents: cartSubtotalCents(rebuilt.cart),
        currency: rebuilt.cart.currency,
      };
    }

    const pendingRaw = this.deps.meta.get(META_CHECKOUT_PENDING);
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as {
          orderId: string;
          paymentId: string;
          checkoutUrl: string;
          cartFingerprint: string;
          idempotencyKey?: string;
        };
        const keyMatch =
          !opts?.idempotencyKey ||
          pending.idempotencyKey === opts.idempotencyKey;
        if (pending.cartFingerprint !== fp) {
          if (!opts?.confirmCartChange) {
            return {
              ok: false,
              code: "cart_changed",
              subtotalCents: cartSubtotalCents(rebuilt.cart),
              currency: rebuilt.cart.currency,
            };
          }
          this.deps.meta.set(META_CHECKOUT_PENDING, "");
        } else if (keyMatch && pending.checkoutUrl) {
          const order = await this.deps.db
            .prepare(
              `SELECT status FROM sales_orders WHERE id = ? AND org_id = ?`,
            )
            .bind(pending.orderId, this.deps.orgId)
            .first<{ status: string }>();
          if (order?.status === "awaiting_payment") {
            return {
              ok: true,
              paymentId: pending.paymentId,
              checkoutUrl: pending.checkoutUrl,
              orderId: pending.orderId,
              reused: true,
            };
          }
          this.deps.meta.set(META_CHECKOUT_PENDING, "");
        }
      } catch {
        this.deps.meta.set(META_CHECKOUT_PENDING, "");
      }
    }

    const awaitingElsewhere = await this.findAwaitingPaymentOnLinkedConversations();
    if (awaitingElsewhere) {
      const pendingRaw2 = this.deps.meta.get(META_CHECKOUT_PENDING);
      let pendingOrderId: string | undefined;
      if (pendingRaw2) {
        try {
          pendingOrderId = (JSON.parse(pendingRaw2) as { orderId?: string }).orderId;
        } catch {
          /* ignore */
        }
      }
      if (
        awaitingElsewhere.orderId !== pendingOrderId &&
        awaitingElsewhere.conversationId !== this.deps.conversationId
      ) {
        return { ok: false, code: "checkout_in_progress" };
      }
    }

    const turnstile = await verifyTurnstileToken(
      this.deps.turnstileSecret,
      opts?.turnstileToken,
      {
        requireConfigured: this.deps.checkoutEnv === "production",
      },
    );
    if (!turnstile.ok) {
      return { ok: false, code: turnstile.code };
    }

    const provider = await loadActivePaymentProvider(
      this.deps.db,
      this.deps.orgId,
      this.deps.encryptionKey,
    );
    if (!provider.ok) return { ok: false, code: provider.code };

    const submitted = await this.submitOrder();
    if (!submitted.ok) return submitted;

    const orderId = submitted.orderId;
    const publicRef = submitted.publicRef;
    const publicAccessToken = submitted.publicAccessToken;
    if (!publicRef) return { ok: false, code: "order_ref_missing" };
    if (!publicAccessToken) return { ok: false, code: "order_access_missing" };

    const cart = parseCart(this.deps.meta.get(META_CART));
    const subtotal = cart.lines.length
      ? cartSubtotalCents(cart)
      : await this.orderSubtotalCents(orderId);
    const currency =
      cart.currency ||
      (await this.orderCurrency(orderId)) ||
      (await this.loadManifest()).currency;

    const paymentId = crypto.randomUUID();
    const apiBase = this.deps.platformApiUrl?.replace(/\/$/, "") ?? "";
    const appBase = this.deps.orderPageBaseUrl?.replace(/\/$/, "") ?? "";
    const redirectUrl = apiBase
      ? `${apiBase}/v1/public/orders/${encodeURIComponent(publicAccessToken)}/payment-return?paymentId=${encodeURIComponent(paymentId)}`
      : appBase
        ? `${appBase}/o/${encodeURIComponent(publicAccessToken)}?payment_return=1&paymentId=${encodeURIComponent(paymentId)}`
        : `/o/${encodeURIComponent(publicAccessToken)}?payment_return=1&paymentId=${encodeURIComponent(paymentId)}`;

    const link = await createProviderCheckoutUrl({
      provider: provider.provider,
      credentials: provider.credentials,
      amountInCents: subtotal,
      currency,
      reference: publicRef,
      redirectUrl,
      description: submitted.summary,
      db: this.deps.db,
      orgId: this.deps.orgId,
      encryptionKey: this.deps.encryptionKey,
    });
    if (!link.ok) return { ok: false, code: link.code };

    await this.deps.db
      .prepare(
        `INSERT INTO payment_attempts (id, org_id, order_id, conversation_id, status, checkout_url, provider, external_ref)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .bind(
        paymentId,
        this.deps.orgId,
        orderId,
        this.deps.conversationId,
        link.url,
        provider.provider,
        link.externalId,
      )
      .run();

    await this.trackCommerceEvent("checkout.started", { orderId, paymentId });

    this.deps.meta.set(
      META_CHECKOUT_PENDING,
      JSON.stringify({
        orderId,
        paymentId,
        checkoutUrl: link.url,
        cartFingerprint: fp,
        idempotencyKey: opts?.idempotencyKey?.slice(0, 128) || undefined,
        createdAt: new Date().toISOString(),
      }),
    );

    return {
      ok: true,
      paymentId,
      checkoutUrl: link.url,
      orderId,
      publicRef,
    };
  }

  private async orderSubtotalCents(orderId: string): Promise<number> {
    const row = await this.deps.db!
      .prepare(`SELECT subtotal_cents FROM sales_orders WHERE id = ?`)
      .bind(orderId)
      .first<{ subtotal_cents: number }>();
    return row?.subtotal_cents ?? 0;
  }

  private async orderCurrency(orderId: string): Promise<string | null> {
    const row = await this.deps.db!
      .prepare(`SELECT currency FROM sales_orders WHERE id = ?`)
      .bind(orderId)
      .first<{ currency: string }>();
    return row?.currency ?? null;
  }

  async getOrder(orderId?: string): Promise<Record<string, unknown> | null> {
    if (!this.deps.db) return null;
    const id =
      orderId?.trim() ||
      this.deps.meta.get(META_LAST_ORDER) ||
      "";
    if (!id) return null;
    const row = await this.deps.db
      .prepare(
        `SELECT id, status, currency, subtotal_cents, summary, buyer_json, lines_json, created_at, public_ref
         FROM sales_orders WHERE id = ? AND org_id = ?`,
      )
      .bind(id, this.deps.orgId)
      .first<Record<string, unknown>>();
    return row ?? null;
  }

  async getPaymentStatus(reference: string): Promise<Record<string, unknown>> {
    if (!this.deps.db || !reference.trim()) {
      return { ok: false, code: "invalid_reference" };
    }
    const provider = await loadActivePaymentProvider(
      this.deps.db,
      this.deps.orgId,
      this.deps.encryptionKey,
    );
    if (!provider.ok) return { ok: false, code: provider.code };
    if (provider.provider !== "declarative") {
      return { ok: false, code: "status_query_declarative_only" };
    }
    const creds = provider.credentials;
    const bundle = await loadOrgIntegrationBundle(
      this.deps.db,
      this.deps.orgId,
      this.deps.encryptionKey,
      { instanceId: creds.instanceId },
    );
    if (!bundle) return { ok: false, code: "integration_not_active" };
    const result = await executeIntegrationCapability(
      bundle,
      "payment.verify",
      { reference },
    );
    if (!result.ok) return { ok: false, code: result.code };
    return { ok: true, ...result.mapped };
  }

  async submitFulfillment(
    input: {
      mode: OrderFulfillmentMode;
      fullName?: string;
      phone?: string;
      city?: string;
      address?: string;
      extra?: string;
    },
  ): Promise<{ ok: true } | { ok: false; code: string; missing?: string[] }> {
    if (!this.deps.db) return { ok: false, code: "not_configured" };
    const orderId = this.deps.meta.get(META_LAST_ORDER)?.trim();
    if (!orderId) return { ok: false, code: "no_order" };

    const row = await this.deps.db
      .prepare(
        `SELECT id, status, fulfillment_json FROM sales_orders WHERE id = ? AND org_id = ?`,
      )
      .bind(orderId, this.deps.orgId)
      .first<{ id: string; status: string; fulfillment_json: string | null }>();

    if (!row) return { ok: false, code: "not_found" };
    if (row.status !== "paid") return { ok: false, code: "order_not_paid" };
    if (row.fulfillment_json) return { ok: false, code: "fulfillment_already_set" };

    const missing: string[] = [];
    if (input.mode === "delivery") {
      if (!input.fullName?.trim()) missing.push("fullName");
      if (!input.phone?.trim()) missing.push("phone");
      if (!input.city?.trim()) missing.push("city");
      if (!input.address?.trim()) missing.push("address");
    }
    if (missing.length) return { ok: false, code: "fulfillment_incomplete", missing };

    const payload: OrderFulfillment = {
      mode: input.mode,
      fullName: input.fullName?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      city: input.city?.trim() || undefined,
      address: input.address?.trim() || undefined,
      extra: input.extra?.trim() || undefined,
      capturedAt: new Date().toISOString(),
    };

    await this.deps.db
      .prepare(
        `UPDATE sales_orders SET fulfillment_json = ?, updated_at = datetime('now')
         WHERE id = ? AND org_id = ? AND status = 'paid'`,
      )
      .bind(JSON.stringify(payload), orderId, this.deps.orgId)
      .run();

    await this.trackCommerceEvent("order.fulfillment_captured", { orderId, mode: input.mode });
    return { ok: true };
  }

  async markPaymentReturned(
    paymentId: string,
    status: "paid" | "failed" | "cancelled",
  ): Promise<void> {
    if (!this.deps.db) return;
    const row = await this.deps.db
      .prepare(`SELECT order_id FROM payment_attempts WHERE id = ? AND org_id = ?`)
      .bind(paymentId, this.deps.orgId)
      .first<{ order_id: string | null }>();
    await this.deps.db
      .prepare(
        `UPDATE payment_attempts SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(status, paymentId)
      .run();
    if (row?.order_id) {
      const orderStatus =
        status === "paid" ? "paid" : status === "failed" ? "failed" : "cancelled";
      await this.deps.db
        .prepare(
          `UPDATE sales_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .bind(orderStatus, row.order_id)
        .run();
    }
    await this.trackCommerceEvent("payment." + status, { paymentId });
  }

  async recordCatalogSearchTelemetry(
    kind: "degraded" | "no_match" | "relaxed",
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.trackCommerceEvent(`catalog.search.${kind}`, meta);
  }

  private async trackCommerceEvent(
    name: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    this.deps.trackEvent?.(name, meta);
    if (!this.deps.db) return;
    await this.deps.db
      .prepare(
        `INSERT INTO commerce_events (id, org_id, bot_id, conversation_id, name, meta_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        this.deps.orgId,
        this.deps.botId,
        this.deps.conversationId,
        name,
        JSON.stringify(meta),
      )
      .run();
  }
}
