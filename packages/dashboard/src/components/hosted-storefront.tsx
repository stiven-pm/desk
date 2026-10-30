"use client";

import type { CommerceCart, CommerceBuyer } from "@chatbot/domain";
import { validateCommerceBuyerField } from "@chatbot/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type PublicChatBootstrap,
} from "@/components/hosted-public-chat";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { resolvePublicApiUrl } from "@/lib/config";
import { humanizeApiError } from "@/lib/errors";
import { migrateStoreChatSessionSplit, publicVisitorStorageKey } from "@/lib/public-visitor-session";

function storefrontCartErrorMessage(code: string | undefined): string {
  switch (code) {
    case "line_notes_required":
      return "Este producto pide una nota o adiciones. Ábrelo y complétala antes de añadir.";
    case "insufficient_stock":
      return "No hay stock suficiente para esa cantidad.";
    case "cart_empty":
      return "Tu carrito está vacío.";
    case "buyer_consent_required":
      return "Acepta el tratamiento de datos para continuar.";
    case "buyer_incomplete":
    case "buyer_required":
      return "Completa tus datos de contacto y entrega.";
    case "turnstile_required":
      return "Confirma la verificación de seguridad para pagar.";
    case "turnstile_failed":
      return "No pasó la verificación. Intenta de nuevo.";
    case "turnstile_not_configured":
      return "El pago no está disponible en este momento. Intenta más tarde.";
    case "checkout_in_progress":
      return "Ya hay un pago en curso. Termínalo o espera unos minutos.";
    case "payment_provider_not_configured":
    case "integration_not_active":
    case "not_configured":
      return "La tienda aún no tiene pasarela de pago activa.";
    default:
      return humanizeApiError(code ?? "request_failed");
  }
}

export type StorefrontBootstrap = PublicChatBootstrap & {
  chatUrl: string;
  storefrontUrl: string;
  publishedProductCount: number;
  turnstileSiteKey?: string | null;
  buyerSteps?: string[];
};

const DEFAULT_STORE_BUYER_STEPS = [
  "name",
  "documentId",
  "phone",
  "city",
  "address",
] as const;

function resolveStoreBuyerSteps(
  bootstrap: StorefrontBootstrap,
): readonly string[] {
  const steps = bootstrap.buyerSteps?.filter(Boolean);
  if (steps?.length) return steps;
  return DEFAULT_STORE_BUYER_STEPS;
}

export type StoreProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  promoLabel: string | null;
  currency: string;
  imageUrl: string | null;
  stockQty: number | null;
  allowsAdditions: boolean;
};

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toLocaleString("es-CO")} ${currency}`;
  }
}

const addToCartButtonClass =
  "rounded-lg bg-[#171717] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-sm";

const addToCartCardLinkClass =
  "mt-3 text-left text-sm font-medium text-black transition hover:drop-shadow-md disabled:opacity-50";

type CartPanelView = "cart" | "consent" | "buyer" | "price" | "turnstile";

const STORE_BUYER_LABEL: Record<string, string> = {
  name: "Nombre completo",
  documentId: "Documento",
  phone: "Celular",
  city: "Ciudad",
  address: "Dirección",
};

function firstOpenBuyerStep(
  buyer: CommerceBuyer | null,
  steps: readonly string[],
): string | null {
  const merged: CommerceBuyer = { type: "natural_person", ...(buyer ?? {}) };
  for (const field of steps) {
    const v = merged[field as keyof CommerceBuyer];
    if (!v || !String(v).trim()) return field;
  }
  return null;
}

function buyerFieldValue(buyer: CommerceBuyer | null, field: string): string {
  const v = buyer?.[field as keyof CommerceBuyer];
  return v != null ? String(v) : "";
}

function IconCart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 6h15l-1.5 9h-12L6 6z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function productMatchesQuery(
  p: { name: string; description: string | null },
  query: string,
): boolean {
  if (!query) return true;
  const hay = `${p.name} ${p.description ?? ""}`.toLowerCase();
  return hay.includes(query);
}

function ProductDetailModal({
  product,
  busy,
  onClose,
  onAdd,
}: {
  product: StoreProduct;
  busy: boolean;
  onClose: () => void;
  onAdd: (lineNotes: string | undefined) => void;
}) {
  const [lineNotes, setLineNotes] = useState("");
  const needsNotes = product.allowsAdditions;
  const canAdd =
    !busy && (!needsNotes || lineNotes.trim().length > 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-[#d8dcde] bg-white shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
        role="dialog"
        aria-modal
        aria-labelledby="product-detail-title"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#d8dcde] px-4 py-3">
          <h2 id="product-detail-title" className="text-base font-semibold">
            {product.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-2 text-[#68737d] hover:bg-[#f8f9f9]"
            aria-label="Cerrar"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/3] w-full bg-[#edf0f2]" />
          )}
          <div className="space-y-3 p-4">
            {product.promoLabel ? (
              <span className="text-[10px] font-semibold uppercase text-emerald-700">
                {product.promoLabel}
              </span>
            ) : null}
            <p className="text-lg font-semibold">
              {formatMoney(product.priceCents, product.currency)}
            </p>
            {product.compareAtPriceCents != null &&
            product.compareAtPriceCents > product.priceCents ? (
              <p className="text-sm text-[#68737d] line-through">
                {formatMoney(product.compareAtPriceCents, product.currency)}
              </p>
            ) : null}
            {product.description ? (
              <p className="whitespace-pre-wrap text-sm text-[#68737d]">
                {product.description}
              </p>
            ) : null}
            {needsNotes ? (
              <textarea
                className="min-h-[72px] w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
                placeholder="Adiciones o nota del pedido"
                value={lineNotes}
                onChange={(e) => setLineNotes(e.target.value)}
                maxLength={400}
              />
            ) : null}
          </div>
        </div>
        <div className="border-t border-[#d8dcde] p-4">
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => onAdd(needsNotes ? lineNotes.trim() : undefined)}
            className={`w-full ${addToCartButtonClass}`}
          >
            Añadir al carrito
          </button>
        </div>
      </div>
    </>
  );
}

function StoreCartPanel({
  view,
  lines,
  currency,
  subtotal,
  busy,
  error,
  buyerStep,
  buyerInput,
  consentChecked,
  onConsentCheckedChange,
  priceTotalCents,
  turnstileSiteKey,
  onTurnstileToken,
  onBuyerInputChange,
  onBack,
  onClose,
  onConsentContinue,
  onPriceConfirm,
  onBuyerContinue,
  onUpdateQty,
  onCheckout,
}: {
  view: CartPanelView;
  lines: CommerceCart["lines"];
  currency: string;
  subtotal: number;
  busy: boolean;
  error: string | null;
  buyerStep: string | null;
  buyerInput: string;
  consentChecked: boolean;
  onConsentCheckedChange: (value: boolean) => void;
  priceTotalCents: number | null;
  turnstileSiteKey: string | null;
  onTurnstileToken: (token: string) => void;
  onBuyerInputChange: (value: string) => void;
  onBack: () => void;
  onClose: () => void;
  onConsentContinue: () => void;
  onPriceConfirm: () => void;
  onBuyerContinue: () => void;
  onUpdateQty: (productId: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  const title =
    view === "consent"
      ? "Autorización"
      : view === "buyer"
        ? "Datos del pedido"
        : view === "price"
          ? "Total actualizado"
          : view === "turnstile"
            ? "Verificación"
            : "Carrito";
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        aria-label="Cerrar carrito"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#d8dcde] bg-white shadow-xl"
        role="dialog"
        aria-label="Carrito"
      >
        <div className="flex items-center justify-between border-b border-[#d8dcde] px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-2 text-[#68737d] hover:bg-[#f8f9f9]"
            aria-label="Cerrar"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {view === "consent" ? (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consentChecked}
                onChange={(e) => onConsentCheckedChange(e.target.checked)}
              />
              <span>
                Autorizo el tratamiento de mis datos personales para gestionar
                este pedido.
              </span>
            </label>
          ) : view === "buyer" && buyerStep ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {STORE_BUYER_LABEL[buyerStep] ?? buyerStep}
              </label>
              <input
                className="w-full rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
                value={buyerInput}
                onChange={(e) => onBuyerInputChange(e.target.value)}
                inputMode={
                  buyerStep === "phone" || buyerStep === "documentId"
                    ? "numeric"
                    : undefined
                }
                placeholder={
                  buyerStep === "phone"
                    ? "3001234567"
                    : buyerStep === "documentId"
                      ? "1234567890"
                      : buyerStep === "name"
                        ? "Nombre y apellido"
                        : undefined
                }
                autoComplete={
                  buyerStep === "phone"
                    ? "tel"
                    : buyerStep === "name"
                      ? "name"
                      : "off"
                }
                maxLength={buyerStep === "address" ? 400 : 120}
              />
            </div>
          ) : view === "price" && priceTotalCents != null ? (
            <p className="text-sm font-semibold">
              Total: {formatMoney(priceTotalCents, currency)}
            </p>
          ) : view === "turnstile" && turnstileSiteKey ? (
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={onTurnstileToken} />
          ) : view === "cart" && lines.length === 0 ? (
            <p className="text-sm text-[#68737d]">Tu carrito está vacío.</p>
          ) : view === "cart" ? (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li
                  key={`${line.productId}\0${line.lineNotes ?? ""}`}
                  className="flex gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.name}</p>
                    {line.lineNotes?.trim() ? (
                      <p className="truncate text-xs text-[#68737d]">
                        {line.lineNotes.trim()}
                      </p>
                    ) : null}
                    <p className="text-xs text-[#68737d]">
                      {formatMoney(line.priceCents, currency)} × {line.quantity}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="rounded border border-[#d8dcde] px-2 py-0.5 text-xs"
                      onClick={() =>
                        onUpdateQty(line.productId, Math.max(0, line.quantity - 1))
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[#d8dcde] px-2 py-0.5 text-xs"
                      onClick={() => onUpdateQty(line.productId, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="border-t border-[#d8dcde] p-4">
          {view === "cart" ? (
            <>
              <p className="text-sm font-semibold">
                Total: {formatMoney(subtotal, currency)}
              </p>
              {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
              <button
                type="button"
                disabled={busy || lines.length === 0}
                onClick={onCheckout}
                className="mt-3 w-full rounded-lg bg-[#2f3941] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Ir a pagar
              </button>
            </>
          ) : view === "consent" ? (
            <>
              {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
              <button
                type="button"
                disabled={busy || !consentChecked}
                onClick={onConsentContinue}
                className="w-full rounded-lg bg-[#2f3941] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Continuar
              </button>
            </>
          ) : view === "buyer" ? (
            <>
              {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
              <button
                type="button"
                disabled={busy || !buyerInput.trim()}
                onClick={onBuyerContinue}
                className="w-full rounded-lg bg-[#2f3941] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Continuar
              </button>
            </>
          ) : view === "price" ? (
            <>
              {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
              <button
                type="button"
                disabled={busy}
                onClick={onPriceConfirm}
                className="w-full rounded-lg bg-[#2f3941] py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Confirmar y pagar
              </button>
            </>
          ) : view === "turnstile" ? (
            error ? <p className="text-xs text-red-700">{error}</p> : null
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function HostedStorefront({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const apiUrl = resolvePublicApiUrl(bootstrap.apiUrl);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<CommerceCart | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [storeVisitorId, setStoreVisitorId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [buyer, setBuyer] = useState<CommerceBuyer | null>(null);
  const [buyerConsentAt, setBuyerConsentAt] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<CartPanelView>("cart");
  const [consentChecked, setConsentChecked] = useState(false);
  const [priceTotalCents, setPriceTotalCents] = useState<number | null>(null);
  const [buyerStep, setBuyerStep] = useState<string | null>(null);
  const [buyerInput, setBuyerInput] = useState("");
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const pendingConfirmPrice = useRef(false);
  const pendingConfirmCart = useRef(false);
  const buyerSteps = useMemo(
    () => resolveStoreBuyerSteps(bootstrap),
    [bootstrap],
  );
  const turnstileSiteKey = bootstrap.turnstileSiteKey?.trim() || null;
  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = useMemo(() => {
    const q = normalizeSearchQuery(productSearch);
    return products.filter((p) => productMatchesQuery(p, q));
  }, [products, productSearch]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("v")?.trim();
      if (fromUrl && fromUrl.length >= 8) {
        localStorage.setItem(
          publicVisitorStorageKey(bootstrap.botId, "visitor", "store"),
          fromUrl,
        );
      }
    }
    let visitorId = localStorage.getItem(
      publicVisitorStorageKey(bootstrap.botId, "visitor", "store"),
    );
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(
        publicVisitorStorageKey(bootstrap.botId, "visitor", "store"),
        visitorId,
      );
    }
    const convKey = publicVisitorStorageKey(bootstrap.botId, "conv", "store");
    const existingConv = localStorage.getItem(convKey);
    const res = await fetch(`${apiUrl}/v1/public/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": bootstrap.publishableKey,
      },
      body: JSON.stringify({
        botId: bootstrap.botId,
        visitorId,
        conversationId: existingConv ?? undefined,
        channel: "store",
      }),
    });
    const data = (await res.json()) as {
      conversationId?: string;
      visitorId?: string;
      error?: string;
    };
    if (!res.ok || !data.conversationId) {
      throw new Error(data.error ?? "session_failed");
    }
    if (data.visitorId) {
      visitorId = data.visitorId;
      localStorage.setItem(
        publicVisitorStorageKey(bootstrap.botId, "visitor", "store"),
        data.visitorId,
      );
    }
    setStoreVisitorId(visitorId);
    localStorage.setItem(convKey, data.conversationId);
    setConversationId(data.conversationId);
    return data.conversationId;
  }, [apiUrl, bootstrap.apiUrl, bootstrap.botId, bootstrap.publishableKey]);

  const refreshCart = useCallback(
    async (convId: string) => {
      const res = await fetch(
        `${apiUrl}/v1/public/conversations/${convId}/commerce/cart`,
        {
          headers: { "X-Api-Key": bootstrap.publishableKey },
        },
      );
      const data = (await res.json()) as {
        cart?: CommerceCart;
        buyer?: CommerceBuyer | null;
        buyerConsentAt?: string | null;
      };
      if (res.ok && data.cart) setCart(data.cart);
      if (res.ok) {
        setBuyer(data.buyer ?? null);
        setBuyerConsentAt(data.buyerConsentAt ?? null);
      }
    },
    [apiUrl, bootstrap.publishableKey],
  );

  useEffect(() => {
    migrateStoreChatSessionSplit(bootstrap.botId);
    let cancelled = false;
    void fetch(
      `${apiUrl}/v1/public/storefront/${encodeURIComponent(bootstrap.orgSlug)}/products`,
    )
      .then(async (res) => {
        const data = (await res.json()) as { products?: StoreProduct[] };
        if (!res.ok) throw new Error("products_failed");
        if (!cancelled) setProducts(data.products ?? []);
      })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No pudimos cargar la tienda.");
      });

    void ensureSession()
      .then((id) => refreshCart(id))
      .catch(() => {
        /* carrito vacío hasta que la sesión responda */
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, bootstrap.orgSlug, ensureSession, refreshCart]);

  useEffect(() => {
    if (!bootstrap.themeCssUrl) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = bootstrap.themeCssUrl;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [bootstrap.themeCssUrl]);

  useEffect(() => {
    if (!detailProduct && !cartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailProduct, cartOpen]);

  async function addProduct(p: StoreProduct, lineNotes?: string) {
    if (busy) return;
    if (p.allowsAdditions && !lineNotes?.trim()) {
      setCartError(null);
      setDetailProduct(p);
      return;
    }
    setBusy(true);
    setCartError(null);
    try {
      const convId = conversationId ?? (await ensureSession());
      const res = await fetch(
        `${apiUrl}/v1/public/conversations/${convId}/commerce/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": bootstrap.publishableKey,
          },
          body: JSON.stringify({
            productId: p.id,
            name: p.name,
            priceCents: p.priceCents,
            currency: p.currency,
            imageUrl: p.imageUrl ?? undefined,
            quantity: 1,
            ...(lineNotes ? { lineNotes } : {}),
          }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; cart?: CommerceCart; code?: string };
      if (!res.ok || !data.ok) {
        setCartError(storefrontCartErrorMessage(data.code));
        return;
      }
      if (data.cart) {
        setCart(data.cart);
        setCartOpen(true);
      }
    } catch {
      setCartError("No se pudo añadir al carrito.");
    } finally {
      setBusy(false);
    }
  }

  async function updateQty(productId: string, quantity: number) {
    if (!conversationId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiUrl}/v1/public/conversations/${conversationId}/commerce/cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": bootstrap.publishableKey,
          },
          body: JSON.stringify({ action: "update", productId, quantity }),
        },
      );
      const data = (await res.json()) as { cart?: CommerceCart };
      if (data.cart) setCart(data.cart);
    } finally {
      setBusy(false);
    }
  }

  async function persistBuyer(
    convId: string,
    patch: Partial<CommerceBuyer> & { consentAccepted?: boolean },
  ): Promise<CommerceBuyer | null> {
    const res = await fetch(
      `${apiUrl}/v1/public/conversations/${convId}/commerce/buyer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": bootstrap.publishableKey,
        },
        body: JSON.stringify({ type: "natural_person", ...patch }),
      },
    );
    const data = (await res.json()) as {
      buyer?: CommerceBuyer;
      ok?: boolean;
      buyerConsentAt?: string | null;
    };
    if (!res.ok || !data.buyer) {
      throw new Error("buyer_save_failed");
    }
    setBuyer(data.buyer);
    if (data.buyerConsentAt) setBuyerConsentAt(data.buyerConsentAt);
    return data.buyer;
  }

  function checkoutIdempotency(): string {
    if (!checkoutIdempotencyKey.current) {
      checkoutIdempotencyKey.current = crypto.randomUUID();
    }
    return checkoutIdempotencyKey.current;
  }

  async function runCheckout(
    convId: string,
    opts?: { confirmPriceChange?: boolean; turnstileToken?: string; confirmCartChange?: boolean },
  ) {
    const res = await fetch(
      `${apiUrl}/v1/public/conversations/${convId}/commerce/start-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": bootstrap.publishableKey,
          "Idempotency-Key": checkoutIdempotency(),
        },
        body: JSON.stringify({
          idempotencyKey: checkoutIdempotency(),
          confirmPriceChange: opts?.confirmPriceChange === true,
          confirmCartChange: opts?.confirmCartChange === true,
          turnstileToken: opts?.turnstileToken,
        }),
      },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      checkoutUrl?: string;
      code?: string;
      subtotalCents?: number;
      currency?: string;
    };
    if (data.checkoutUrl) {
      pendingConfirmPrice.current = false;
      pendingConfirmCart.current = false;
      window.location.href = data.checkoutUrl;
      return;
    }
    if (
      (data.code === "price_changed" || data.code === "cart_changed") &&
      data.subtotalCents != null
    ) {
      if (data.code === "price_changed") pendingConfirmPrice.current = true;
      if (data.code === "cart_changed") pendingConfirmCart.current = true;
      setPriceTotalCents(data.subtotalCents);
      setPanelView("price");
      return;
    }
    if (data.code === "turnstile_required") {
      setPanelView("turnstile");
      return;
    }
    setCartError(storefrontCartErrorMessage(data.code));
  }

  function closeCartPanel() {
    setCartOpen(false);
    setPanelView("cart");
    setBuyerStep(null);
    setBuyerInput("");
    setConsentChecked(false);
    setPriceTotalCents(null);
    setCartError(null);
  }

  function panelBack() {
    if (panelView === "turnstile") {
      setPanelView("price");
      setCartError(null);
      return;
    }
    if (panelView === "price") {
      setPanelView("cart");
      setPriceTotalCents(null);
      setCartError(null);
      return;
    }
    if (panelView === "buyer" && buyerStep) {
      const idx = buyerSteps.indexOf(buyerStep);
      if (idx <= 0) {
        setPanelView(buyerConsentAt ? "cart" : "consent");
        setBuyerStep(null);
        setBuyerInput("");
        return;
      }
      const prev = buyerSteps[idx - 1]!;
      setBuyerStep(prev);
      setBuyerInput(buyerFieldValue(buyer, prev));
      return;
    }
    if (panelView === "consent") {
      setPanelView("cart");
      setConsentChecked(false);
      return;
    }
    closeCartPanel();
  }

  async function onTurnstileToken(token: string) {
    if (busy) return;
    setBusy(true);
    setCartError(null);
    try {
      const convId = conversationId ?? (await ensureSession());
      await runCheckout(convId, {
        confirmPriceChange: pendingConfirmPrice.current,
        confirmCartChange: pendingConfirmCart.current,
        turnstileToken: token,
      });
    } catch {
      setCartError("No se pudo iniciar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (busy) return;
    setBusy(true);
    setCartError(null);
    try {
      const convId = conversationId ?? (await ensureSession());
      if (!buyerConsentAt) {
        setPanelView("consent");
        return;
      }
      const step = firstOpenBuyerStep(buyer, buyerSteps);
      if (step) {
        setPanelView("buyer");
        setBuyerStep(step);
        setBuyerInput(buyerFieldValue(buyer, step));
        return;
      }
      await runCheckout(convId);
    } catch {
      setCartError("No se pudo iniciar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function submitConsent() {
    if (!consentChecked || busy) return;
    setBusy(true);
    setCartError(null);
    try {
      const convId = conversationId ?? (await ensureSession());
      await persistBuyer(convId, { consentAccepted: true });
      const step = firstOpenBuyerStep(buyer, buyerSteps);
      if (step) {
        setPanelView("buyer");
        setBuyerStep(step);
        setBuyerInput(buyerFieldValue(buyer, step));
        return;
      }
      await runCheckout(convId);
    } catch {
      setCartError("No se pudo guardar la autorización.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPriceCheckout() {
    if (busy) return;
    setBusy(true);
    setCartError(null);
    try {
      const convId = conversationId ?? (await ensureSession());
      await runCheckout(convId, {
        confirmPriceChange: true,
        confirmCartChange: pendingConfirmCart.current,
      });
    } catch {
      setCartError("No se pudo iniciar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBuyerStep() {
    if (!buyerStep || !buyerInput.trim() || busy) return;
    const checked = validateCommerceBuyerField(buyerStep, buyerInput);
    if (!checked.ok) {
      setCartError(checked.message);
      return;
    }
    setBusy(true);
    setCartError(null);
    try {
      const convId = conversationId ?? (await ensureSession());
      const saved = await persistBuyer(convId, {
        [buyerStep]: checked.value,
      });
      const next = firstOpenBuyerStep(saved, buyerSteps);
      if (next) {
        setPanelView("buyer");
        setBuyerStep(next);
        setBuyerInput(buyerFieldValue(saved, next));
        return;
      }
      setBuyerStep(null);
      setBuyerInput("");
      await runCheckout(convId);
    } catch {
      setCartError("Revisa el dato e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const lines = cart?.lines ?? [];
  const currency = cart?.currency ?? products[0]?.currency ?? "COP";
  const subtotal = lines.reduce(
    (sum, l) => sum + l.priceCents * l.quantity,
    0,
  );
  const cartCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  if (loadError && !ready) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm text-[#68737d]">
        {loadError}
      </main>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f8f9f9] pb-24 text-[#2f3941]">
      <header className="sticky top-0 z-30 border-b border-[#d8dcde] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <h1 className="truncate text-lg font-semibold">{bootstrap.orgName}</h1>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative rounded-full p-2.5 text-[#2f3941] hover:bg-[#f8f9f9]"
            aria-label="Carrito"
          >
            <IconCart className="h-6 w-6" />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2f3941] px-1 text-[10px] font-semibold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!ready ? (
          <p className="text-sm text-[#68737d]">Cargando productos…</p>
        ) : products.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#d8dcde] bg-white p-6 text-sm text-[#68737d]">
            Aún no hay productos publicados.
          </p>
        ) : (
          <>
            <div className="relative mb-5">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68737d]" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar productos"
                className="w-full rounded-xl border border-[#d8dcde] bg-white py-2.5 pl-10 pr-4 text-sm text-[#2f3941] shadow-sm outline-none transition placeholder:text-[#68737d] focus:border-[#2f3941] focus:ring-1 focus:ring-[#2f3941]/20"
                aria-label="Buscar productos"
              />
            </div>
            {filteredProducts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#d8dcde] bg-white p-6 text-center text-sm text-[#68737d]">
                Ningún producto coincide con tu búsqueda.
              </p>
            ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((p) => (
              <article
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailProduct(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailProduct(p);
                  }
                }}
                className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[#d8dcde] bg-white shadow-sm transition hover:border-[#c2c8cc]"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[4/3] w-full bg-[#edf0f2]" />
                )}
                <div className="flex flex-1 flex-col p-4">
                  {p.promoLabel ? (
                    <span className="text-[10px] font-semibold uppercase text-emerald-700">
                      {p.promoLabel}
                    </span>
                  ) : null}
                  <h3 className="font-medium">{p.name}</h3>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#68737d]">
                      {p.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold">
                    {formatMoney(p.priceCents, p.currency)}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void addProduct(p);
                    }}
                    className={addToCartCardLinkClass}
                  >
                    Añadir al carrito
                  </button>
                </div>
              </article>
            ))}
          </div>
            )}
          </>
        )}
      </main>

      {detailProduct ? (
        <ProductDetailModal
          product={detailProduct}
          busy={busy}
          onClose={() => setDetailProduct(null)}
          onAdd={(lineNotes) => {
            void addProduct(detailProduct, lineNotes);
            setDetailProduct(null);
          }}
        />
      ) : null}

      {cartOpen ? (
        <StoreCartPanel
          view={panelView}
          lines={lines}
          currency={currency}
          subtotal={subtotal}
          busy={busy}
          error={cartError}
          buyerStep={buyerStep}
          buyerInput={buyerInput}
          consentChecked={consentChecked}
          onConsentCheckedChange={setConsentChecked}
          priceTotalCents={priceTotalCents}
          turnstileSiteKey={turnstileSiteKey}
          onTurnstileToken={(token) => void onTurnstileToken(token)}
          onBuyerInputChange={setBuyerInput}
          onBack={panelBack}
          onClose={closeCartPanel}
          onConsentContinue={() => void submitConsent()}
          onPriceConfirm={() => void confirmPriceCheckout()}
          onBuyerContinue={() => void submitBuyerStep()}
          onUpdateQty={(id, q) => void updateQty(id, q)}
          onCheckout={() => void checkout()}
        />
      ) : null}
    </div>
  );
}
