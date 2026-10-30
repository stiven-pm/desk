import {
  connectorConfigSchema,
  effectiveOperationRequest,
  effectiveResponseMap,
  integrationFieldSchema,
  integrationOperationSchema,
  normalizeIntegrationCapability,
  paymentProfileSchema,
  parseIntegrationFields,
  type IntegrationOperationDef,
} from "@chatbot/domain";
import type { Env } from "../types";
import { randomId } from "./http";
import { z } from "zod";

const upsertDefinitionSchema = z.object({
  slug: z.string().min(2).max(64),
  name: z.string().min(2).max(120),
  kind: z.enum(["payment", "commerce", "api", "other"]),
  description: z.string().max(500).optional(),
  fields: z.array(integrationFieldSchema).min(1),
  connector: connectorConfigSchema.default({}),
  paymentProfile: paymentProfileSchema.optional(),
  testOperationId: z.string().max(64).optional(),
  operations: z.array(integrationOperationSchema).max(128).default([]),
});

export type IntegrationDefinitionPayload = z.infer<typeof upsertDefinitionSchema>;

function operationToRow(
  definitionId: string,
  version: number,
  op: IntegrationOperationDef,
): {
  id: string;
  definition_id: string;
  definition_version: number;
  capability: string;
  slug: string;
  tool_name: string | null;
  description: string | null;
  method: string;
  path_template: string;
  body_template: string | null;
  query_template_json: string;
  response_map_json: string;
  params_json: string;
  request_json: string | null;
  response_json: string;
  test_args_json: string | null;
  expose_to_ai: number;
  side_effect: string;
  requires_confirm: number;
  sort_order: number;
  auth_mode: string;
  auth_field_key: string | null;
} {
  const id = op.id?.trim() || randomId();
  const http = effectiveOperationRequest(op);
  const response = effectiveResponseMap(op);
  return {
    id,
    definition_id: definitionId,
    definition_version: version,
    capability: normalizeIntegrationCapability(op.capability),
    slug: op.slug,
    tool_name: op.toolName?.trim() || null,
    description: op.description?.trim() || null,
    method: http.method,
    path_template: http.pathTemplate,
    body_template: http.bodyTemplate ?? null,
    query_template_json: JSON.stringify(http.queryTemplate ?? {}),
    response_map_json: JSON.stringify(op.responseMap ?? { fields: {} }),
    params_json: JSON.stringify(op.params ?? []),
    request_json: op.request ? JSON.stringify(op.request) : null,
    response_json: JSON.stringify(response),
    test_args_json: op.testArgs ? JSON.stringify(op.testArgs) : null,
    expose_to_ai: op.exposeToAi ? 1 : 0,
    side_effect: op.sideEffect,
    requires_confirm: op.requiresConfirm ? 1 : 0,
    sort_order: op.sortOrder,
    auth_mode: op.authMode ?? "inherit",
    auth_field_key: op.authFieldKey?.trim() || null,
  };
}

async function loadOperations(
  env: Env,
  definitionId: string,
  version: number,
): Promise<IntegrationOperationDef[]> {
  const rows = await env.DB.prepare(
    `SELECT id, capability, slug, tool_name, description, method, path_template, body_template,
            query_template_json, response_map_json, params_json, request_json, response_json,
            test_args_json, expose_to_ai, side_effect, requires_confirm, sort_order,
            auth_mode, auth_field_key
     FROM integration_operations
     WHERE definition_id = ? AND definition_version = ?
     ORDER BY sort_order, slug`,
  )
    .bind(definitionId, version)
    .all();

  const out: IntegrationOperationDef[] = [];
  for (const r of rows.results ?? []) {
    const parsed = integrationOperationSchema.safeParse({
      id: r.id,
      capability: normalizeIntegrationCapability(String(r.capability)),
      slug: r.slug,
      toolName: r.tool_name ?? undefined,
      description: r.description ?? undefined,
      method: r.method,
      pathTemplate: r.path_template,
      bodyTemplate: r.body_template ?? undefined,
      queryTemplate: JSON.parse(String(r.query_template_json || "{}")),
      responseMap: JSON.parse(String(r.response_map_json || '{"fields":{}}')),
      params: JSON.parse(String(r.params_json || "[]")),
      request: r.request_json
        ? JSON.parse(String(r.request_json))
        : undefined,
      response: r.response_json
        ? JSON.parse(String(r.response_json))
        : undefined,
      testArgs: r.test_args_json
        ? JSON.parse(String(r.test_args_json))
        : undefined,
      exposeToAi: r.expose_to_ai === 1,
      sideEffect: r.side_effect,
      requiresConfirm: r.requires_confirm === 1,
      sortOrder: r.sort_order,
      authMode: (r.auth_mode as string) || "inherit",
      authFieldKey: (r.auth_field_key as string) || undefined,
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function listIntegrationDefinitionsFull(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT id, slug, name, kind, description, fields_json, status, version,
            connector_json, payment_profile_json, test_operation_id
     FROM integration_definitions WHERE status = 'active' ORDER BY name`,
  ).all();

  const definitions = [];
  for (const r of rows.results ?? []) {
    const version = Number(r.version ?? 1);
    definitions.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      kind: r.kind,
      description: r.description,
      version,
      fields: parseIntegrationFields(r.fields_json as string),
      connector: connectorConfigSchema.parse(
        JSON.parse(String(r.connector_json || "{}")),
      ),
      paymentProfile: r.payment_profile_json
        ? paymentProfileSchema.parse(JSON.parse(String(r.payment_profile_json)))
        : null,
      testOperationId: r.test_operation_id as string | null,
      operations: await loadOperations(env, String(r.id), version),
    });
  }
  return definitions;
}

export async function createIntegrationDefinition(
  env: Env,
  payload: IntegrationDefinitionPayload,
): Promise<string> {
  const data = upsertDefinitionSchema.parse(payload);
  const id = randomId();
  const version = 1;
  await env.DB.prepare(
    `INSERT INTO integration_definitions
     (id, slug, name, kind, description, fields_json, version, connector_json, payment_profile_json, test_operation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      data.slug,
      data.name,
      data.kind,
      data.description ?? null,
      JSON.stringify(data.fields),
      version,
      JSON.stringify(data.connector),
      data.paymentProfile ? JSON.stringify(data.paymentProfile) : null,
      data.testOperationId ?? null,
    )
    .run();

  for (const op of data.operations) {
    const row = operationToRow(id, version, op);
    await env.DB.prepare(
      `INSERT INTO integration_operations
       (id, definition_id, definition_version, capability, slug, tool_name, description, method, path_template,
        body_template, query_template_json, response_map_json, params_json, request_json, response_json,
        test_args_json, expose_to_ai, side_effect, requires_confirm, sort_order,
        auth_mode, auth_field_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        row.id,
        row.definition_id,
        row.definition_version,
        row.capability,
        row.slug,
        row.tool_name,
        row.description,
        row.method,
        row.path_template,
        row.body_template,
        row.query_template_json,
        row.response_map_json,
        row.params_json,
        row.request_json,
        row.response_json,
        row.test_args_json,
        row.expose_to_ai,
        row.side_effect,
        row.requires_confirm,
        row.sort_order,
        row.auth_mode,
        row.auth_field_key,
      )
      .run();
  }
  return id;
}

export async function updateIntegrationDefinition(
  env: Env,
  definitionId: string,
  payload: IntegrationDefinitionPayload,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const data = upsertDefinitionSchema.parse(payload);
  const existing = await env.DB.prepare(
    `SELECT version FROM integration_definitions WHERE id = ? AND status = 'active'`,
  )
    .bind(definitionId)
    .first<{ version: number }>();
  if (!existing) return { ok: false, error: "not_found" };

  const instCount = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM org_integration_instances WHERE definition_id = ?`,
  )
    .bind(definitionId)
    .first<{ c: number }>();

  const nextVersion =
    (instCount?.c ?? 0) > 0 ? existing.version + 1 : existing.version;

  await env.DB.prepare(
    `UPDATE integration_definitions SET slug = ?, name = ?, kind = ?, description = ?,
     fields_json = ?, version = ?, connector_json = ?, payment_profile_json = ?,
     test_operation_id = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      data.slug,
      data.name,
      data.kind,
      data.description ?? null,
      JSON.stringify(data.fields),
      nextVersion,
      JSON.stringify(data.connector),
      data.paymentProfile ? JSON.stringify(data.paymentProfile) : null,
      data.testOperationId ?? null,
      definitionId,
    )
    .run();

  await env.DB.prepare(
    `DELETE FROM integration_operations WHERE definition_id = ? AND definition_version = ?`,
  )
    .bind(definitionId, nextVersion)
    .run();

  const reuseStableOperationIds = nextVersion === existing.version;
  for (const op of data.operations) {
    const opForRow =
      reuseStableOperationIds || !op.id?.trim()
        ? op
        : { ...op, id: undefined };
    const row = operationToRow(definitionId, nextVersion, opForRow);
    await env.DB.prepare(
      `INSERT INTO integration_operations
       (id, definition_id, definition_version, capability, slug, tool_name, description, method, path_template,
        body_template, query_template_json, response_map_json, params_json, request_json, response_json,
        test_args_json, expose_to_ai, side_effect, requires_confirm, sort_order,
        auth_mode, auth_field_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        row.id,
        row.definition_id,
        row.definition_version,
        row.capability,
        row.slug,
        row.tool_name,
        row.description,
        row.method,
        row.path_template,
        row.body_template,
        row.query_template_json,
        row.response_map_json,
        row.params_json,
        row.request_json,
        row.response_json,
        row.test_args_json,
        row.expose_to_ai,
        row.side_effect,
        row.requires_confirm,
        row.sort_order,
        row.auth_mode,
        row.auth_field_key,
      )
      .run();
  }

  return { ok: true, version: nextVersion };
}

async function insertIntegrationDefinition(
  env: Env,
  definitionId: string,
  data: IntegrationDefinitionPayload,
): Promise<void> {
  const version = 1;
  await env.DB.prepare(
    `INSERT INTO integration_definitions
     (id, slug, name, kind, description, fields_json, version, connector_json, payment_profile_json, test_operation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      definitionId,
      data.slug,
      data.name,
      data.kind,
      data.description ?? null,
      JSON.stringify(data.fields),
      version,
      JSON.stringify(data.connector),
      data.paymentProfile ? JSON.stringify(data.paymentProfile) : null,
      data.testOperationId ?? null,
    )
    .run();

  for (const op of data.operations) {
    const row = operationToRow(definitionId, version, op);
    await env.DB.prepare(
      `INSERT INTO integration_operations
       (id, definition_id, definition_version, capability, slug, tool_name, description, method, path_template,
        body_template, query_template_json, response_map_json, params_json, request_json, response_json,
        test_args_json, expose_to_ai, side_effect, requires_confirm, sort_order,
        auth_mode, auth_field_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        row.id,
        row.definition_id,
        row.definition_version,
        row.capability,
        row.slug,
        row.tool_name,
        row.description,
        row.method,
        row.path_template,
        row.body_template,
        row.query_template_json,
        row.response_map_json,
        row.params_json,
        row.request_json,
        row.response_json,
        row.test_args_json,
        row.expose_to_ai,
        row.side_effect,
        row.requires_confirm,
        row.sort_order,
        row.auth_mode,
        row.auth_field_key,
      )
      .run();
  }
}

export async function syncBuiltinIntegrationDefinition(
  env: Env,
  preferredId: string,
  payload: IntegrationDefinitionPayload,
): Promise<void> {
  const data = upsertDefinitionSchema.parse(payload);
  const existing = await env.DB.prepare(
    `SELECT id FROM integration_definitions WHERE slug = ? AND status = 'active'`,
  )
    .bind(data.slug)
    .first<{ id: string }>();

  if (existing) {
    const result = await updateIntegrationDefinition(env, existing.id, data);
    if (!result.ok) throw new Error(`builtin_sync_failed:${result.error}`);
    return;
  }

  await insertIntegrationDefinition(env, preferredId, data);
}
