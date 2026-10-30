import {
  declarativeCredentialsSchema,
  parseCommerceManifest,
  parseProviderCredentials,
  type PaymentProviderId,
} from "@chatbot/domain";
import type { Env } from "../types";
import { decryptSecret, encryptSecret } from "./crypto";

export type OrgPaymentProviderRow = {
  org_id: string;
  provider: PaymentProviderId;
  status: "pending_setup" | "active" | "error";
  credentials_enc: string | null;
  last_verified_at: string | null;
  last_error: string | null;
};

export async function getOrgPaymentProvider(
  env: Env,
  orgId: string,
): Promise<OrgPaymentProviderRow | null> {
  return env.DB.prepare(
    `SELECT org_id, provider, status, credentials_enc, last_verified_at, last_error
     FROM org_payment_providers WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<OrgPaymentProviderRow>();
}

export async function upsertOrgPaymentProvider(
  env: Env,
  orgId: string,
  provider: PaymentProviderId,
  credentials: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (provider !== "declarative") {
    return { ok: false, error: "invalid_provider" };
  }
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false, error: "encryption_not_configured" };

  try {
    parseProviderCredentials(provider, credentials);
  } catch {
    return { ok: false, error: "invalid_credentials" };
  }

  const credentialsEnc = await encryptSecret(JSON.stringify(credentials), encKey);
  await env.DB.prepare(
    `INSERT INTO org_payment_providers (org_id, provider, status, credentials_enc, updated_at)
     VALUES (?, 'declarative', 'pending_setup', ?, datetime('now'))
     ON CONFLICT(org_id) DO UPDATE SET
       provider = 'declarative',
       status = 'pending_setup',
       credentials_enc = excluded.credentials_enc,
       last_error = NULL,
       updated_at = datetime('now')`,
  )
    .bind(orgId, credentialsEnc)
    .run();

  return { ok: true };
}

export async function verifyOrgPaymentProvider(
  env: Env,
  orgId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await getOrgPaymentProvider(env, orgId);
  if (!row?.credentials_enc) {
    return { ok: false, error: "payment_provider_not_configured" };
  }
  if (row.provider !== "declarative") {
    return { ok: false, error: "payment_provider_not_configured" };
  }

  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false, error: "encryption_not_configured" };

  const plain = await decryptSecret(row.credentials_enc, encKey);
  if (!plain) return { ok: false, error: "decrypt_failed" };

  const creds = JSON.parse(plain) as Record<string, string>;
  try {
    declarativeCredentialsSchema.parse(creds);
  } catch {
    await markProviderError(env, orgId, "invalid_credentials");
    return { ok: false, error: "invalid_credentials" };
  }

  await env.DB.prepare(
    `UPDATE org_payment_providers SET status = 'active', last_verified_at = datetime('now'),
     last_error = NULL, updated_at = datetime('now') WHERE org_id = ?`,
  )
    .bind(orgId)
    .run();

  return { ok: true };
}

async function markProviderError(
  env: Env,
  orgId: string,
  error: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE org_payment_providers SET status = 'error', last_error = ?, updated_at = datetime('now')
     WHERE org_id = ?`,
  )
    .bind(error.slice(0, 200), orgId)
    .run();
}

export async function syncDeclarativeWebhookSecret(
  env: Env,
  orgId: string,
  eventsSecret: string,
): Promise<void> {
  const prev = await env.DB.prepare(
    `SELECT mode, manifest_json FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ mode: string; manifest_json: string | null }>();

  const manifest = parseCommerceManifest(prev?.manifest_json);
  const merged = {
    ...manifest,
    confirmationMode: "automatic" as const,
    paymentProviders: {
      ...manifest.paymentProviders,
      genericWebhookSecret: eventsSecret,
    },
  };
  const mode = prev?.mode === "checkout_link" ? "checkout_link" : "order_only";
  await env.DB.prepare(
    `INSERT INTO org_commerce_config (org_id, mode, manifest_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(org_id) DO UPDATE SET manifest_json = excluded.manifest_json, updated_at = datetime('now')`,
  )
    .bind(orgId, mode, JSON.stringify(merged))
    .run();
}

export async function decryptOrgPaymentCredentials(
  env: Env,
  orgId: string,
): Promise<
  | { ok: true; provider: PaymentProviderId; credentials: Record<string, string> }
  | { ok: false }
> {
  const row = await getOrgPaymentProvider(env, orgId);
  if (!row || row.status !== "active" || !row.credentials_enc) {
    return { ok: false };
  }
  if (row.provider !== "declarative") return { ok: false };
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false };
  const plain = await decryptSecret(row.credentials_enc, encKey);
  if (!plain) return { ok: false };
  return {
    ok: true,
    provider: "declarative",
    credentials: JSON.parse(plain) as Record<string, string>,
  };
}
