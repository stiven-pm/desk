import { parseCommerceManifest } from "@chatbot/domain";
import type { Env } from "../types";
import { randomId } from "./http";

export async function ensureOrgPaymentWebhookToken(
  env: Env,
  orgId: string,
): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT payment_webhook_token, manifest_json FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ payment_webhook_token: string | null; manifest_json: string | null }>();

  if (row?.payment_webhook_token?.trim()) {
    return row.payment_webhook_token.trim();
  }

  const token = randomId().replace(/-/g, "");
  await env.DB.prepare(
    `INSERT INTO org_commerce_config (org_id, mode, payment_webhook_token, updated_at)
     VALUES (?, 'order_only', ?, datetime('now'))
     ON CONFLICT(org_id) DO UPDATE SET
       payment_webhook_token = excluded.payment_webhook_token,
       updated_at = datetime('now')`,
  )
    .bind(orgId, token)
    .run();

  return token;
}

export async function resolveOrgByPaymentWebhookToken(
  env: Env,
  token: string,
): Promise<{ orgId: string; manifestJson: string | null } | null> {
  const row = await env.DB.prepare(
    `SELECT org_id, manifest_json FROM org_commerce_config WHERE payment_webhook_token = ?`,
  )
    .bind(token)
    .first<{ org_id: string; manifest_json: string | null }>();
  if (!row) return null;
  return { orgId: row.org_id, manifestJson: row.manifest_json };
}

export function paymentWebhookBaseUrl(env: Env): string {
  const base =
    env.PLATFORM_API_URL?.trim() ||
    env.APP_URL?.trim() ||
    "https://api.desk.rekov.co";
  return base.replace(/\/$/, "");
}

export function paymentWebhookUrl(env: Env, token: string): string {
  const base = paymentWebhookBaseUrl(env);
  return `${base}/webhooks/commerce-payments/${token}/declarative`;
}

/** @deprecated use paymentWebhookUrl */
export function paymentWebhookUrls(
  env: Env,
  token: string,
): { declarative: string } {
  return { declarative: paymentWebhookUrl(env, token) };
}

export function providerSecretsFromManifest(manifestJson: string | null) {
  return parseCommerceManifest(manifestJson).paymentProviders ?? {};
}
