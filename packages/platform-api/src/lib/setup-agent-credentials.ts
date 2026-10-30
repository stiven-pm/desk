import { z } from "zod";
import { createHttpToolSchema, upsertConnectorSchema } from "@chatbot/domain";
import { decryptSecret, encryptSecret } from "./crypto";
import { randomId } from "./http";
import { invalidateBotCache } from "./tenant-cache";
import {
  materializeConnectorTools,
  persistConnectorTools,
} from "./connectors";
import { enrichConnectorConfig } from "./connector-enrich";
import { syncOpenApiTools } from "./integration-openapi";
import type { Env } from "../types";

export const credentialFieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "password", "url"]).default("password"),
  required: z.boolean().optional(),
});

export const applyConnectorSchema = z.object({
  kind: z.literal("connector"),
  connectorKey: upsertConnectorSchema.shape.connectorKey,
  /** Map form field key → key inside connector config */
  fieldMap: z.record(z.string()),
  enabled: z.boolean().optional(),
});

export const applyOpenApiSchema = z.object({
  kind: z.literal("openapi"),
  baseUrl: z.string().url(),
  authType: z.enum(["none", "bearer", "header"]).default("none"),
  authHeaderName: z.string().optional(),
  fieldMap: z.record(z.string()).optional(),
});

export const applyHttpToolSchema = z.object({
  kind: z.literal("http_tool"),
  tool: createHttpToolSchema,
  authField: z.string().optional(),
});

export const requestCredentialsSchema = z.object({
  title: z.string().min(1).max(200),
  purpose: z.string().max(2000).optional(),
  fields: z.array(credentialFieldSchema).min(1).max(12),
  apply: z.discriminatedUnion("kind", [
    applyConnectorSchema,
    applyOpenApiSchema,
    applyHttpToolSchema,
  ]),
});

export type CredentialRequestRow = {
  id: string;
  title: string;
  purpose: string;
  fields_json: string;
  apply_kind: string;
  status: string;
  created_at: string;
};

export async function listPendingCredentialRequests(
  db: D1Database,
  botId: string,
  orgId: string,
): Promise<CredentialRequestRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, title, purpose, fields_json, apply_kind, status, created_at
       FROM bot_setup_credential_requests
       WHERE bot_id = ? AND org_id = ? AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 5`,
    )
    .bind(botId, orgId)
    .all<CredentialRequestRow>();
  return rows.results ?? [];
}

export async function createCredentialRequest(
  env: Env,
  params: {
    botId: string;
    orgId: string;
    body: z.infer<typeof requestCredentialsSchema>;
  },
): Promise<{ id: string; fields: z.infer<typeof credentialFieldSchema>[] }> {
  const id = randomId();
  const applyKind = params.body.apply.kind;
  await env.DB.prepare(
    `INSERT INTO bot_setup_credential_requests
     (id, bot_id, org_id, title, purpose, apply_kind, apply_json, fields_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(
      id,
      params.botId,
      params.orgId,
      params.body.title,
      params.body.purpose ?? "",
      applyKind,
      JSON.stringify(params.body.apply),
      JSON.stringify(params.body.fields),
    )
    .run();
  return { id, fields: params.body.fields };
}

export async function fulfillCredentialRequest(
  env: Env,
  params: {
    botId: string;
    orgId: string;
    requestId: string;
    values: Record<string, string>;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false, error: "encryption_not_configured" };

  const row = await env.DB.prepare(
    `SELECT id, apply_kind, apply_json, fields_json, status
     FROM bot_setup_credential_requests
     WHERE id = ? AND bot_id = ? AND org_id = ?`,
  )
    .bind(params.requestId, params.botId, params.orgId)
    .first<{
      id: string;
      apply_kind: string;
      apply_json: string;
      fields_json: string;
      status: string;
    }>();

  if (!row || row.status !== "pending") {
    return { ok: false, error: "not_found_or_closed" };
  }

  const fields = JSON.parse(row.fields_json) as z.infer<
    typeof credentialFieldSchema
  >[];
  for (const f of fields) {
    if (f.required !== false && !String(params.values[f.key] ?? "").trim()) {
      return { ok: false, error: `missing_field:${f.key}` };
    }
  }

  const apply = JSON.parse(row.apply_json) as
    | z.infer<typeof applyConnectorSchema>
    | z.infer<typeof applyOpenApiSchema>
    | z.infer<typeof applyHttpToolSchema>;

  try {
    if (apply.kind === "connector") {
      const config: Record<string, unknown> = {};
      for (const [formKey, configKey] of Object.entries(apply.fieldMap)) {
        const v = params.values[formKey];
        if (v !== undefined && v !== "") config[configKey] = v;
      }
      let merged = config;
      const existing = await env.DB.prepare(
        `SELECT id, config_enc FROM bot_connectors WHERE bot_id = ? AND connector_key = ?`,
      )
        .bind(params.botId, apply.connectorKey)
        .first<{ id: string; config_enc: string }>();
      if (existing?.config_enc) {
        const prev = await decryptSecret(existing.config_enc, encKey);
        if (prev) {
          merged = { ...(JSON.parse(prev) as Record<string, unknown>), ...config };
        }
      }
      merged = await enrichConnectorConfig(apply.connectorKey, merged);
      const configEnc = await encryptSecret(JSON.stringify(merged), encKey);
      const connId = existing?.id ?? randomId();
      if (existing) {
        await env.DB.prepare(
          `UPDATE bot_connectors SET config_enc = ?, enabled = ?, status = 'connected', updated_at = datetime('now') WHERE id = ?`,
        )
          .bind(
            configEnc,
            apply.enabled === false ? 0 : 1,
            connId,
          )
          .run();
      } else {
        await env.DB.prepare(
          `INSERT INTO bot_connectors (id, bot_id, connector_key, config_enc, enabled, status)
           VALUES (?, ?, ?, ?, ?, 'connected')`,
        )
          .bind(
            connId,
            params.botId,
            apply.connectorKey,
            configEnc,
            apply.enabled === false ? 0 : 1,
          )
          .run();
      }
      const defs = materializeConnectorTools(apply.connectorKey, merged);
      await persistConnectorTools(env.DB, params.botId, connId, defs, encKey);
    } else if (apply.kind === "openapi") {
      const authField = apply.fieldMap
        ? Object.keys(apply.fieldMap)[0]
        : "authSecret";
      const secretKey = apply.fieldMap?.[authField] ?? authField;
      const authSecret = params.values[secretKey] ?? params.values.authSecret;
      let authSecretEnc: string | null = null;
      if (authSecret && apply.authType !== "none") {
        authSecretEnc = await encryptSecret(String(authSecret), encKey);
      }
      const existing = await env.DB.prepare(
        `SELECT id, spec_json FROM bot_openapi_configs WHERE bot_id = ? LIMIT 1`,
      )
        .bind(params.botId)
        .first<{ id: string; spec_json: string }>();
      const configId = existing?.id ?? randomId();
      const specStr = existing?.spec_json ?? "{}";
      if (existing) {
        await env.DB.prepare(
          `UPDATE bot_openapi_configs SET base_url = ?, auth_type = ?, auth_header_name = ?, auth_secret_enc = COALESCE(?, auth_secret_enc), updated_at = datetime('now') WHERE id = ?`,
        )
          .bind(
            apply.baseUrl,
            apply.authType,
            apply.authHeaderName ?? null,
            authSecretEnc,
            configId,
          )
          .run();
      } else {
        return {
          ok: false,
          error: "openapi_spec_missing_import_first",
        };
      }
      await syncOpenApiTools(env.DB, params.botId, configId, specStr);
    } else if (apply.kind === "http_tool") {
      const authField = apply.authField ?? "authSecret";
      const authSecret = params.values[authField];
      const tool = apply.tool;
      let authSecretEnc: string | null = null;
      const authType = (params.values.authType as string) || "bearer";
      if (authSecret) {
        authSecretEnc = await encryptSecret(String(authSecret), encKey);
      }
      const id = randomId();
      await env.DB.prepare(
        `INSERT INTO bot_http_tools (id, bot_id, name, description, method, path, base_url, auth_type, auth_header_name, auth_secret_enc, parameters_json, source, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
      )
        .bind(
          id,
          params.botId,
          tool.name,
          tool.description,
          tool.method,
          tool.path,
          tool.baseUrl ?? "",
          authType,
          params.values.authHeaderName ?? null,
          authSecretEnc,
          JSON.stringify(tool.parameters ?? []),
          tool.enabled === false ? 0 : 1,
        )
        .run();
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fulfill_failed",
    };
  }

  await env.DB.prepare(
    `UPDATE bot_setup_credential_requests SET status = 'fulfilled', fulfilled_at = datetime('now') WHERE id = ?`,
  )
    .bind(params.requestId)
    .run();
  await invalidateBotCache(env, params.botId);
  return { ok: true };
}
