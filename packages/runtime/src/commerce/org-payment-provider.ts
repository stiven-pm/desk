import { declarativeCredentialsSchema, type PaymentProviderId } from "@chatbot/domain";
import { decryptSecret } from "../integrations/crypto";
import {
  executeIntegrationCapability,
  loadOrgIntegrationBundle,
} from "../integrations/integration-runtime";

export async function loadActivePaymentProvider(
  db: D1Database,
  orgId: string,
  encryptionKey: string | undefined,
): Promise<
  | { ok: true; provider: PaymentProviderId; credentials: Record<string, string> }
  | { ok: false; code: string }
> {
  const row = await db
    .prepare(
      `SELECT provider, status, credentials_enc FROM org_payment_providers WHERE org_id = ?`,
    )
    .bind(orgId)
    .first<{
      provider: PaymentProviderId;
      status: string;
      credentials_enc: string | null;
    }>();
  if (!row || row.status !== "active" || !row.credentials_enc) {
    return { ok: false, code: "payment_provider_not_active" };
  }
  if (row.provider !== "declarative") {
    return { ok: false, code: "payment_provider_not_active" };
  }
  if (!encryptionKey?.trim()) {
    return { ok: false, code: "encryption_not_configured" };
  }
  const plain = await decryptSecret(row.credentials_enc, encryptionKey);
  if (!plain) return { ok: false, code: "decrypt_failed" };
  return {
    ok: true,
    provider: "declarative",
    credentials: JSON.parse(plain) as Record<string, string>,
  };
}

export async function createProviderCheckoutUrl(args: {
  provider: PaymentProviderId;
  credentials: Record<string, string>;
  amountInCents: number;
  currency: string;
  reference: string;
  redirectUrl: string;
  description: string;
  db?: D1Database;
  orgId?: string;
  encryptionKey?: string;
}): Promise<{ ok: true; url: string; externalId: string } | { ok: false; code: string }> {
  if (args.provider !== "declarative") {
    return { ok: false, code: "provider_not_supported" };
  }
  const creds = declarativeCredentialsSchema.parse(args.credentials);
  if (!args.db || !args.orgId || !args.encryptionKey) {
    return { ok: false, code: "declarative_context_missing" };
  }
  const bundle = await loadOrgIntegrationBundle(
    args.db,
    args.orgId,
    args.encryptionKey,
    { instanceId: creds.instanceId },
  );
  if (!bundle) return { ok: false, code: "integration_not_active" };
  const result = await executeIntegrationCapability(
    bundle,
    "payment.create_link",
    {
      reference: args.reference,
      amountInCents: String(args.amountInCents),
      currency: args.currency,
      redirectUrl: args.redirectUrl,
      description: args.description,
    },
  );
  if (!result.ok) return { ok: false, code: result.code ?? "checkout_failed" };
  let checkoutUrl = String(result.mapped.checkoutUrl ?? "").trim();
  const externalId = String(result.mapped.externalId ?? args.reference).trim();
  if (!checkoutUrl && externalId) {
    checkoutUrl = `https://checkout.wompi.co/l/${encodeURIComponent(externalId)}`;
  }
  if (!checkoutUrl) return { ok: false, code: "checkout_url_missing" };
  return { ok: true, url: checkoutUrl, externalId };
}
