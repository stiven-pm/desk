import type { CommerceManifest } from "./commerce-manifest";

export type CommerceReadinessItem = {
  id: string;
  label: string;
  ok: boolean;
  href: string;
  hint?: string;
};

export type CommerceReadinessSnapshot = {
  items: CommerceReadinessItem[];
  readyToSell: boolean;
  completedCount: number;
  totalCount: number;
};

export type CommerceReadinessContext = {
  manifest: CommerceManifest;
  commerceMode: "order_only" | "checkout_link";
  publishedProductCount: number;
  readyDocuments: number;
  activeHttpTools: number;
  pendingCatalogImports: number;
  catalogPdfReady: number;
  paymentProviderActive: boolean;
  hasPublishableKey: boolean;
};

function hasPaymentConfigured(ctx: CommerceReadinessContext): boolean {
  if (ctx.manifest.commerceProfile === "support_only") return true;
  return ctx.paymentProviderActive;
}

function hasCatalogSignal(ctx: CommerceReadinessContext): boolean {
  const src = ctx.manifest.onboardingProfile?.catalogSource;
  if (ctx.publishedProductCount > 0) return true;
  if (ctx.catalogPdfReady > 0) return true;
  if (src === "files" && ctx.readyDocuments > 0) return true;
  if ((src === "api" || src === "import_curl") && ctx.activeHttpTools > 0) return true;
  if (src === "create") return ctx.publishedProductCount > 0;
  if (src === "import_pdf" && ctx.pendingCatalogImports > 0) return true;
  return false;
}

/** Checklist de venta nativa / asistida (sin secretos en RAG). */
export function computeCommerceReadiness(
  ctx: CommerceReadinessContext,
): CommerceReadinessSnapshot {
  const items: CommerceReadinessItem[] = [
    {
      id: "catalog",
      label: "Catálogo",
      ok: hasCatalogSignal(ctx),
      href: "/dashboard/panel",
      hint: "Sube un PDF en Panel o publica productos con precio.",
    },
    {
      id: "payment",
      label: "Integración de pagos",
      ok: hasPaymentConfigured(ctx),
      href: "/dashboard/integraciones",
      hint: "Completa los datos que Rekov habilitó para tu pasarela.",
    },
    {
      id: "chat",
      label: "Chat publicado",
      ok: ctx.hasPublishableKey,
      href: "/dashboard/channels",
      hint: "Copia el enlace del chat en Configuración · Web.",
    },
  ];

  const needsCommerce =
    ctx.manifest.commerceProfile !== "support_only";
  const readyToSell =
    ctx.hasPublishableKey &&
    (!needsCommerce ||
      (hasCatalogSignal(ctx) && hasPaymentConfigured(ctx)));

  return {
    items,
    readyToSell,
    completedCount: items.filter((i) => i.ok).length,
    totalCount: items.length,
  };
}
