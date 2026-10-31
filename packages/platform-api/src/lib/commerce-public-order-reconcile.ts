import {
  effectiveOperationRequest,
  getJsonPath,
  normalizeIntegrationCapability,
  parseCommerceManifest,
  parseDeclarativeWebhook,
  paymentProfileSchema,
  type IntegrationOperationDef,
} from "@chatbot/domain";
import { executeIntegrationOperation } from "@chatbot/runtime/integrations/integration-http-engine";
import {
  loadOrgIntegrationBundle,
} from "@chatbot/runtime/integrations/integration-runtime";
import type { Env } from "../types";
import { fulfillCommerceOrderPaid, type SalesOrderPayableRow } from "./commerce-order-paid";

type ReconcileOrderRow = SalesOrderPayableRow & {
  org_id: string;
  public_ref: string | null;
};

async function loadOrgDeclarativePaymentProfile(env: Env, orgId: string) {
  const row = await env.DB.prepare(
    `SELECT d.payment_profile_json
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     JOIN org_payment_providers p ON p.org_id = i.org_id
     WHERE i.org_id = ? AND i.status = 'connected' AND d.kind = 'payment'
       AND p.provider = 'declarative' AND p.status = 'active'
     ORDER BY i.updated_at DESC LIMIT 1`,
  )
    .bind(orgId)
    .first<{ payment_profile_json: string | null }>();
  if (!row?.payment_profile_json?.trim()) return undefined;
  try {
    return paymentProfileSchema.parse(JSON.parse(row.payment_profile_json));
  } catch {
    return undefined;
  }
}

function pickPaymentVerifyOperation(
  bundle: NonNullable<Awaited<ReturnType<typeof loadOrgIntegrationBundle>>>,
) {
  for (const op of bundle.operations) {
    if (normalizeIntegrationCapability(String(op.capability)) !== "payment.verify") {
      continue;
    }
    const req = effectiveOperationRequest(op);
    const path = `${req.pathTemplate ?? ""}`;
    const query = JSON.stringify(req.queryTemplate ?? {});
    if (path.includes("merchants")) continue;
    if (path.includes("transactions") || query.includes("reference")) {
      return op;
    }
  }
  const bySlug = bundle.operations.find((o) => o.slug === "transaction_by_reference");
  if (bySlug) return bySlug;
  return wompiTransactionByReferenceOperation();
}

/** Operación estándar Wompi cuando la plantilla en D1 aún solo tiene verify_merchant. */
function wompiTransactionByReferenceOperation(): IntegrationOperationDef {
  return {
    capability: "payment.verify",
    slug: "transaction_by_reference_fallback",
    method: "GET",
    pathTemplate: "/transactions",
    queryTemplate: { reference: "{{reference}}" },
    params: [],
    response: {
      fields: {
        status: "data[0].status",
        orderReference: "data[0].reference",
      },
    },
    responseMap: {
      fields: {
        status: "data[0].status",
        orderReference: "data[0].reference",
      },
    },
    exposeToAi: false,
    sideEffect: "read",
    requiresConfirm: false,
    sortOrder: 99,
    authMode: "inherit",
  };
}

function wompiTransactionByIdOperation(): IntegrationOperationDef {
  return {
    capability: "payment.verify",
    slug: "transaction_by_id_fallback",
    method: "GET",
    pathTemplate: "/transactions/{{transactionId}}",
    queryTemplate: {},
    params: [],
    response: {
      fields: {
        status: "data.status",
        orderReference: "data.reference",
      },
    },
    responseMap: {
      fields: {
        status: "data.status",
        orderReference: "data.reference",
      },
    },
    exposeToAi: false,
    sideEffect: "read",
    requiresConfirm: false,
    sortOrder: 98,
    authMode: "inherit",
  };
}

function wompiPaymentLinkOperation(): IntegrationOperationDef {
  return {
    capability: "custom",
    slug: "payment_link_status_fallback",
    method: "GET",
    pathTemplate: "/payment_links/{{externalId}}",
    queryTemplate: {},
    params: [],
    response: {
      fields: {
        linkStatus: "data.status",
        linkActive: "data.active",
        txStatus: "data.transaction.status",
        txReference: "data.transaction.reference",
      },
    },
    responseMap: {
      fields: {
        linkStatus: "data.status",
        linkActive: "data.active",
        txStatus: "data.transaction.status",
        txReference: "data.transaction.reference",
      },
    },
    exposeToAi: false,
    sideEffect: "read",
    requiresConfirm: false,
    sortOrder: 100,
    authMode: "inherit",
  };
}

function providerStatusIsPaid(
  profile: Awaited<ReturnType<typeof loadOrgDeclarativePaymentProfile>>,
  statusRaw: string,
): boolean {
  if (!statusRaw.trim() || !profile) return false;
  const s = statusRaw.trim().toLowerCase();
  return (profile.paidStatusValues ?? []).some((v) => s === v.toLowerCase());
}

function paidFromProviderPayload(
  bodyJson: unknown,
  profile: NonNullable<Awaited<ReturnType<typeof loadOrgDeclarativePaymentProfile>>>,
  reference: string,
  orderId: string,
  opts?: { ignoreReferenceMismatch?: boolean },
): { paid: boolean; eventId: string; orderReference: string | null } {
  const parsed = parseDeclarativeWebhook(bodyJson, profile);
  const mappedStatus = String(
    getJsonPath(bodyJson, "data.status") ??
      getJsonPath(bodyJson, "data[0].status") ??
      "",
  ).trim();
  const txStatus = String(
    getJsonPath(bodyJson, "data.status") ??
      getJsonPath(bodyJson, "data.transaction.status") ??
      getJsonPath(bodyJson, "data[0].status") ??
      "",
  ).trim();
  const statusCandidate = mappedStatus || txStatus || parsed.rawStatus || "";
  const ref =
    String(
      getJsonPath(bodyJson, "data.reference") ??
        getJsonPath(bodyJson, "data[0].reference") ??
        getJsonPath(bodyJson, "data.transaction.reference") ??
        parsed.orderReference ??
        "",
    ).trim() || null;
  const refMatches =
    opts?.ignoreReferenceMismatch ||
    !ref ||
    ref === reference ||
    ref === orderId;
  const paid =
    refMatches &&
    (parsed.status === "paid" || providerStatusIsPaid(profile, statusCandidate));
  return {
    paid,
    eventId: parsed.eventId,
    orderReference: ref,
  };
}

async function loadLatestPaymentExternalId(
  env: Env,
  orgId: string,
  orderId: string,
  paymentId?: string | null,
): Promise<string | null> {
  if (paymentId?.trim()) {
    const row = await env.DB.prepare(
      `SELECT external_ref FROM payment_attempts WHERE id = ? AND org_id = ?`,
    )
      .bind(paymentId.trim(), orgId)
      .first<{ external_ref: string | null }>();
    if (row?.external_ref?.trim()) return row.external_ref.trim();
  }
  const latest = await env.DB.prepare(
    `SELECT external_ref FROM payment_attempts
     WHERE order_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(orderId, orgId)
    .first<{ external_ref: string | null }>();
  return latest?.external_ref?.trim() ?? null;
}

async function loadPaymentProviderInstanceId(
  env: Env,
  orgId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT credentials_enc FROM org_payment_providers
     WHERE org_id = ? AND provider = 'declarative' AND status = 'active'`,
  )
    .bind(orgId)
    .first<{ credentials_enc: string | null }>();
  if (!row?.credentials_enc?.trim() || !env.ENCRYPTION_KEY?.trim()) return null;
  const { decryptSecret } = await import("./crypto");
  const plain = await decryptSecret(row.credentials_enc, env.ENCRYPTION_KEY);
  if (!plain) return null;
  try {
    const creds = JSON.parse(plain) as { instanceId?: string };
    return creds.instanceId?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Consulta pasarela por referencia RK-… y marca pagado si la API lo confirma. */
export async function reconcilePublicOrderPayment(
  env: Env,
  row: ReconcileOrderRow,
  opts?: {
    paymentId?: string | null;
    providerTransactionId?: string | null;
  },
): Promise<{ ok: boolean; code: string; status?: string }> {
  if (row.status === "paid") {
    return { ok: true, code: "already_paid", status: "paid" };
  }
  if (!["awaiting_payment", "pending_verification"].includes(row.status)) {
    return { ok: true, code: "not_awaiting", status: row.status };
  }

  const manifestRow = await env.DB.prepare(
    `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(row.org_id)
    .first<{ manifest_json: string | null }>();
  const manifest = parseCommerceManifest(manifestRow?.manifest_json);
  if (manifest.confirmationMode !== "automatic") {
    return { ok: true, code: "manual_confirmation_mode", status: row.status };
  }

  const paymentId = opts?.paymentId?.trim();
  if (paymentId) {
    const attempt = await env.DB.prepare(
      `SELECT order_id, status FROM payment_attempts WHERE id = ? AND org_id = ?`,
    )
      .bind(paymentId, row.org_id)
      .first<{ order_id: string | null; status: string }>();
    if (!attempt || attempt.order_id !== row.id) {
      return { ok: false, code: "payment_mismatch" };
    }
  }

  const reference = row.public_ref?.trim();
  if (!reference) {
    return { ok: false, code: "missing_public_ref" };
  }

  const profile = await loadOrgDeclarativePaymentProfile(env, row.org_id);
  if (!profile) {
    return { ok: false, code: "payment_profile_missing" };
  }

  const instanceId = await loadPaymentProviderInstanceId(env, row.org_id);
  if (!instanceId || !env.ENCRYPTION_KEY?.trim()) {
    return { ok: false, code: "payment_provider_not_active" };
  }

  const bundle = await loadOrgIntegrationBundle(
    env.DB,
    row.org_id,
    env.ENCRYPTION_KEY,
    { instanceId },
  );
  if (!bundle) {
    return { ok: false, code: "integration_not_active" };
  }

  const markPaidFromPayload = async (
    bodyJson: unknown,
    source: "public_return" | "public_return_link" | "public_return_tx",
    eventIdOverride?: string,
  ): Promise<{ ok: boolean; code: string; status?: string } | null> => {
    const ignoreReferenceMismatch =
      source === "public_return_tx" || source === "public_return_link";
    const first = paidFromProviderPayload(
      bodyJson,
      profile,
      reference,
      row.id,
      { ignoreReferenceMismatch },
    );
    if (!first.paid) return null;
    const fulfilled = await fulfillCommerceOrderPaid(env, row.org_id, row, {
      source,
      reference,
      provider: "declarative",
      eventId: eventIdOverride ?? first.eventId,
    });
    if (!fulfilled.ok) return fulfilled;
    return {
      ok: true,
      code: fulfilled.already ? "already_paid" : "paid",
      status: "paid",
    };
  };

  const providerTxId = opts?.providerTransactionId?.trim();
  if (providerTxId) {
    const txResult = await executeIntegrationOperation(
      bundle.connector,
      wompiTransactionByIdOperation(),
      bundle.values,
      { transactionId: providerTxId, reference },
    );
    if (txResult.ok) {
      const fromTx = await markPaidFromPayload(
        txResult.bodyJson,
        "public_return_tx",
        providerTxId,
      );
      if (fromTx) return fromTx;
    }
  }

  const verifyOp = pickPaymentVerifyOperation(bundle);

  const result = await executeIntegrationOperation(
    bundle.connector,
    verifyOp,
    bundle.values,
    { reference },
  );
  if (result.ok) {
    const fromRef = await markPaidFromPayload(
      result.bodyJson,
      "public_return",
    );
    if (fromRef) return fromRef;
  }

  const externalId = await loadLatestPaymentExternalId(
    env,
    row.org_id,
    row.id,
    paymentId,
  );
  if (externalId) {
    const linkResult = await executeIntegrationOperation(
      bundle.connector,
      wompiPaymentLinkOperation(),
      bundle.values,
      { externalId, reference },
    );
    if (linkResult.ok) {
      const txStatus = String(linkResult.mapped.txStatus ?? "").trim();
      const second = paidFromProviderPayload(
        linkResult.bodyJson,
        profile,
        reference,
        row.id,
        { ignoreReferenceMismatch: true },
      );
      const linkPaid = second.paid || providerStatusIsPaid(profile, txStatus);
      if (linkPaid) {
        const fulfilled = await fulfillCommerceOrderPaid(env, row.org_id, row, {
          source: "public_return_link",
          reference,
          provider: "declarative",
          eventId: second.eventId || `link-${externalId}`,
        });
        if (!fulfilled.ok) return fulfilled;
        return {
          ok: true,
          code: fulfilled.already ? "already_paid" : "paid",
          status: "paid",
        };
      }
    }
  }

  if (!result.ok) {
    return { ok: false, code: result.code ?? "verify_failed" };
  }

  const parsed = parseDeclarativeWebhook(result.bodyJson, profile);
  return {
    ok: true,
    code: parsed.status === "failed" ? "provider_failed" : "still_pending",
    status: row.status,
  };
}
