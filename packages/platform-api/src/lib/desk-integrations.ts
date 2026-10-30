import {
  parseIntegrationFields,
  paymentProfileSchema,
  type IntegrationFieldDef,
} from "@chatbot/domain";
import type { Env } from "../types";
import { decryptSecret, encryptSecret } from "./crypto";
import { randomId } from "./http";
import {
  upsertOrgPaymentProvider,
  verifyOrgPaymentProvider,
  syncDeclarativeWebhookSecret,
} from "./org-payment-provider";
import {
  findOperation,
  loadOrgIntegrationBundle,
} from "@chatbot/runtime/integrations/integration-runtime";

export type OrgIntegrationRow = {
  id: string;
  org_id: string;
  definition_id: string;
  status: string;
  values_enc: string | null;
  last_error: string | null;
  enabled: number;
};

export async function listOrgDeskIntegrations(env: Env, orgId: string) {
  const rows = await env.DB.prepare(
    `SELECT i.id, i.status, i.last_error, i.enabled, i.values_enc,
            d.id as def_id, d.slug, d.name, d.kind, d.description, d.fields_json
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     WHERE i.org_id = ? AND d.status = 'active' AND i.enabled = 1
     ORDER BY d.kind, d.name`,
  )
    .bind(orgId)
    .all<{
      id: string;
      status: string;
      last_error: string | null;
      enabled: number;
      values_enc: string | null;
      def_id: string;
      slug: string;
      name: string;
      kind: string;
      description: string | null;
      fields_json: string;
    }>();

  const out = [];
  for (const r of rows.results ?? []) {
    const fields = parseIntegrationFields(r.fields_json);
    const values = await loadOrgIntegrationValues(env, r.values_enc);
    out.push({
      instanceId: r.id,
      status: r.status,
      lastError: r.last_error,
      enabled: r.enabled === 1,
      definition: {
        id: r.def_id,
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        description: r.description,
        fields,
      },
      fieldState: maskFieldState(fields, values),
    });
  }
  return out;
}

export async function loadOrgIntegrationValues(
  env: Env,
  valuesEnc: string | null,
): Promise<Record<string, string> | null> {
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!valuesEnc || !encKey) return null;
  const plain = await decryptSecret(valuesEnc, encKey);
  if (!plain) return null;
  return JSON.parse(plain) as Record<string, string>;
}

export function maskFieldState(
  fields: IntegrationFieldDef[],
  values: Record<string, string> | null,
): Record<string, { set: boolean; masked?: string }> {
  const out: Record<string, { set: boolean; masked?: string }> = {};
  for (const f of fields) {
    const v = values?.[f.key]?.trim();
    if (!v) {
      out[f.key] = { set: false };
    } else if (f.secret) {
      out[f.key] = { set: true, masked: "••••••••" };
    } else {
      out[f.key] = { set: true, masked: v.length > 48 ? `${v.slice(0, 24)}…` : v };
    }
  }
  return out;
}

export async function saveOrgIntegrationValues(
  env: Env,
  orgId: string,
  instanceId: string,
  values: Record<string, string>,
): Promise<
  { ok: true } | { ok: false; error: string; detail?: string }
> {
  const row = await env.DB.prepare(
    `SELECT i.id, i.definition_id, i.values_enc, d.slug, d.kind, d.fields_json
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     WHERE i.id = ? AND i.org_id = ?`,
  )
    .bind(instanceId, orgId)
    .first<{
      id: string;
      definition_id: string;
      values_enc: string | null;
      slug: string;
      kind: string;
      fields_json: string;
    }>();
  if (!row) return { ok: false, error: "not_found" };

  const fields = parseIntegrationFields(row.fields_json);
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false, error: "encryption_not_configured" };

  const prev = await loadOrgIntegrationValues(env, row.values_enc);
  const merged: Record<string, string> = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(values)) {
    if (!v.trim() && prev?.[k]?.trim()) continue;
    merged[k] = v.trim();
  }
  for (const f of fields) {
    if (f.required && !merged[f.key]?.trim()) {
      return {
        ok: false,
        error: "missing_required_field",
        detail: `Falta el campo obligatorio: ${f.label || f.key}.`,
      };
    }
  }

  const valuesEnc = await encryptSecret(JSON.stringify(merged), encKey);
  await env.DB.prepare(
    `UPDATE org_integration_instances SET values_enc = ?, status = 'pending',
     last_error = NULL, updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
  )
    .bind(valuesEnc, instanceId, orgId)
    .run();

  if (row.kind === "payment") {
    let up: Awaited<ReturnType<typeof upsertOrgPaymentProvider>>;
    try {
      up = await upsertOrgPaymentProvider(env, orgId, "declarative", {
        instanceId,
        definitionId: row.definition_id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/CHECK constraint|constraint failed/i.test(msg)) {
        return {
          ok: false,
          error: "payment_provider_schema",
          detail:
            "Base de datos desactualizada (migración 0029). Avísanos si persiste tras el deploy.",
        };
      }
      throw e;
    }
    if (!up.ok) return { ok: false, error: up.error };
    const defRow = await env.DB.prepare(
      `SELECT payment_profile_json FROM integration_definitions WHERE id = ?`,
    )
      .bind(row.definition_id)
      .first<{ payment_profile_json: string | null }>();
    if (defRow?.payment_profile_json) {
      try {
        const profile = paymentProfileSchema.parse(
          JSON.parse(defRow.payment_profile_json),
        );
        const secretKey = profile.webhookAuth.secretFieldKey ?? "eventsSecret";
        const secret = merged[secretKey]?.trim();
        if (profile.syncGenericWebhookSecret && secret) {
          await syncDeclarativeWebhookSecret(env, orgId, secret);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { ok: true };
}

export async function activateOrgIntegration(
  env: Env,
  orgId: string,
  instanceId: string,
): Promise<
  { ok: true } | { ok: false; error: string; detail?: string }
> {
  const row = await env.DB.prepare(
    `SELECT i.id, i.values_enc, d.kind, d.id as definition_id, d.test_operation_id
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     WHERE i.id = ? AND i.org_id = ?`,
  )
    .bind(instanceId, orgId)
    .first<{
      id: string;
      values_enc: string | null;
      kind: string;
      definition_id: string;
      test_operation_id: string | null;
    }>();
  if (!row) return { ok: false, error: "not_found" };

  if (!row.values_enc) {
    return {
      ok: false,
      error: "missing_credentials",
      detail: "Guarda las credenciales antes de probar la conexión.",
    };
  }

  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false, error: "encryption_not_configured" };

  const bundle = await loadOrgIntegrationBundle(env.DB, orgId, encKey, {
    instanceId,
    includePending: true,
  });
  if (!bundle) {
    return {
      ok: false,
      error: "integration_not_ready",
      detail:
        "Faltan campos obligatorios o no se pudieron leer las credenciales guardadas.",
    };
  }

  if (row.kind === "payment") {
    const up = await upsertOrgPaymentProvider(env, orgId, "declarative", {
      instanceId,
      definitionId: row.definition_id,
    });
    if (!up.ok) return up;
  }

  const testOpId = row.test_operation_id;
  const testOp = testOpId
    ? bundle.operations.find((o) => o.id === testOpId || o.slug === testOpId)
    : findOperation(bundle, "payment.verify");

  if (testOp) {
    const args: Record<string, string> = {};
    if (testOp.testArgs) {
      for (const [k, v] of Object.entries(testOp.testArgs)) {
        args[k] = String(v);
      }
    }
    const { executeIntegrationOperation } = await import(
      "@chatbot/runtime/integrations/integration-http-engine"
    );
    const testResult = await executeIntegrationOperation(
      bundle.connector,
      testOp,
      bundle.values,
      args,
    );
    if (!testResult.ok) {
      const code = testResult.code ?? "test_failed";
      const detail =
        testResult.detail ??
        (code === "url_host_mismatch"
          ? "El host del conector no coincide con la allowlist (en Ops usa solo el dominio, ej. sandbox.wompi.co)."
          : code === "http_error"
            ? `La API respondió HTTP${testResult.status ? ` ${testResult.status}` : ""}. Revisa credenciales y la operación de prueba en la plantilla.`
            : code === "template_unresolved"
              ? "Quedó un {{campo}} sin reemplazar: guarda el valor del tenant o corrige el path en Ops."
              : code === "base_url_missing"
                ? "Falta la URL base del conector en la plantilla Ops."
                : undefined);
      await env.DB.prepare(
        `UPDATE org_integration_instances SET status = 'error', last_error = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(code.slice(0, 200), instanceId)
        .run();
      return { ok: false, error: code, detail };
    }
  }

  if (row.kind === "payment") {
    const v = await verifyOrgPaymentProvider(env, orgId);
    if (!v.ok) {
      await env.DB.prepare(
        `UPDATE org_integration_instances SET status = 'error', last_error = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(v.error.slice(0, 200), instanceId)
        .run();
      return v;
    }
  }

  await env.DB.prepare(
    `UPDATE org_integration_instances SET status = 'connected', last_error = NULL,
     updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
  )
    .bind(instanceId, orgId)
    .run();

  return { ok: true };
}

export async function assignIntegrationToOrg(
  env: Env,
  orgId: string,
  definitionId: string,
): Promise<string> {
  const def = await env.DB.prepare(
    `SELECT version FROM integration_definitions WHERE id = ?`,
  )
    .bind(definitionId)
    .first<{ version: number }>();
  const pinned = def?.version ?? 1;
  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO org_integration_instances (id, org_id, definition_id, status, enabled, pinned_version)
     VALUES (?, ?, ?, 'pending', 1, ?)
     ON CONFLICT(org_id, definition_id) DO UPDATE SET enabled = 1, updated_at = datetime('now')`,
  )
    .bind(id, orgId, definitionId, pinned)
    .run();
  const row = await env.DB.prepare(
    `SELECT id FROM org_integration_instances WHERE org_id = ? AND definition_id = ?`,
  )
    .bind(orgId, definitionId)
    .first<{ id: string }>();
  return row?.id ?? id;
}

export async function listOrgDeskIntegrationsForOps(env: Env, orgId: string) {
  const rows = await env.DB.prepare(
    `SELECT i.id, i.status, i.last_error, i.enabled,
            d.id as def_id, d.slug, d.name, d.kind
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     WHERE i.org_id = ? AND d.status = 'active'
     ORDER BY i.enabled DESC, d.name`,
  )
    .bind(orgId)
    .all<{
      id: string;
      status: string;
      last_error: string | null;
      enabled: number;
      def_id: string;
      slug: string;
      name: string;
      kind: string;
    }>();
  return (rows.results ?? []).map((r) => ({
    instanceId: r.id,
    status: r.status,
    lastError: r.last_error,
    enabled: r.enabled === 1,
    definition: {
      id: r.def_id,
      slug: r.slug,
      name: r.name,
      kind: r.kind,
    },
  }));
}

export async function revokeOrgDeskIntegration(
  env: Env,
  orgId: string,
  instanceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await env.DB.prepare(
    `SELECT i.id, d.kind
     FROM org_integration_instances i
     JOIN integration_definitions d ON d.id = i.definition_id
     WHERE i.id = ? AND i.org_id = ?`,
  )
    .bind(instanceId, orgId)
    .first<{ id: string; kind: string }>();
  if (!row) return { ok: false, error: "not_found" };

  await env.DB.prepare(
    `UPDATE org_integration_instances SET enabled = 0, updated_at = datetime('now')
     WHERE id = ? AND org_id = ?`,
  )
    .bind(instanceId, orgId)
    .run();

  if (row.kind === "payment") {
    await env.DB.prepare(
      `UPDATE org_payment_providers SET status = 'pending_setup', updated_at = datetime('now')
       WHERE org_id = ?`,
    )
      .bind(orgId)
      .run();
  }

  return { ok: true };
}
