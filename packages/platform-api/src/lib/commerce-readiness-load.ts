import {
  computeCommerceReadiness,
  parseCommerceManifest,
  type CommerceReadinessSnapshot,
} from "@chatbot/domain";
import type { Env } from "../types";
import { getPublishableKeyPlain } from "./publishable-key";

/** Pasarela lista: org_payment_providers activo o integración Desk kind=payment conectada. */
export async function orgPaymentGatewayReady(
  env: Env,
  orgId: string,
): Promise<boolean> {
  const payProv = await env.DB.prepare(
    `SELECT status FROM org_payment_providers WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ status: string }>();
  if (payProv?.status === "active") return true;

  const inst = await env.DB.prepare(
    `SELECT 1 AS ok FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     WHERE i.org_id = ? AND i.enabled = 1 AND i.status = 'connected' AND d.kind = 'payment'
     LIMIT 1`,
  )
    .bind(orgId)
    .first<{ ok: number }>();
  return Boolean(inst);
}

export async function loadCommerceReadinessForOrg(
  env: Env,
  orgId: string,
): Promise<CommerceReadinessSnapshot & { onboardingProfile: unknown }> {
  const commerceRow = await env.DB.prepare(
    `SELECT mode, manifest_json FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ mode: string; manifest_json: string | null }>();

  const manifest = parseCommerceManifest(commerceRow?.manifest_json);
  const commerceMode =
    commerceRow?.mode === "checkout_link" ? "checkout_link" : "order_only";

  const bot = await env.DB.prepare(
    `SELECT id FROM bots WHERE org_id = ? ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(orgId)
    .first<{ id: string }>();

  let hasPublishableKey = false;
  if (bot?.id) {
    const key = await getPublishableKeyPlain(env, bot.id);
    hasPublishableKey = Boolean(key?.trim());
  }

  const productCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM products WHERE org_id = ? AND status = 'published'`,
  )
    .bind(orgId)
    .first<{ n: number }>();

  const docs = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM sources WHERE org_id = ? AND status = 'ready'`,
  )
    .bind(orgId)
    .first<{ n: number }>();

  const httpTools = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bot_http_tools t
     JOIN bots b ON b.id = t.bot_id
     WHERE b.org_id = ? AND t.enabled = 1`,
  )
    .bind(orgId)
    .first<{ n: number }>();

  const catalogDrafts = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM catalog_import_drafts
     WHERE org_id = ? AND status = 'pending_review'`,
  )
    .bind(orgId)
    .first<{ n: number }>();

  const catalogPdf = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM sources
     WHERE org_id = ? AND status = 'ready'
       AND title IN ('Catálogo', 'Catálogo (referencia)')`,
  )
    .bind(orgId)
    .first<{ n: number }>();

  const paymentGatewayReady = await orgPaymentGatewayReady(env, orgId);

  const snapshot = computeCommerceReadiness({
    manifest,
    commerceMode,
    publishedProductCount: productCount?.n ?? 0,
    readyDocuments: docs?.n ?? 0,
    activeHttpTools: httpTools?.n ?? 0,
    pendingCatalogImports: catalogDrafts?.n ?? 0,
    catalogPdfReady: catalogPdf?.n ?? 0,
    paymentProviderActive: paymentGatewayReady,
    hasPublishableKey,
  });

  return {
    ...snapshot,
    onboardingProfile: manifest.onboardingProfile ?? null,
  };
}
