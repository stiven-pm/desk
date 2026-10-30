import {
  capabilityMatchKeys,
  connectorConfigSchema,
  effectiveResponseMap,
  integrationCapabilitySchema,
  integrationOperationSchema,
  normalizeIntegrationCapability,
  paymentProfileSchema,
  parseIntegrationFields,
  type IntegrationCapability,
  type IntegrationOperationDef,
  type StandardIntegrationCapability,
  getJsonPath,
} from "@chatbot/domain";
import { decryptSecret } from "./crypto";
import {
  executeIntegrationOperation,
  type HttpEngineResult,
} from "./integration-http-engine";

export type IntegrationDefinitionBundle = {
  definitionId: string;
  instanceId: string;
  kind: string;
  slug: string;
  version: number;
  connector: ReturnType<typeof connectorConfigSchema.parse>;
  paymentProfile: ReturnType<typeof paymentProfileSchema.parse> | null;
  operations: IntegrationOperationDef[];
  values: Record<string, string>;
};

type OpRow = {
  id: string;
  capability: string;
  slug: string;
  tool_name: string | null;
  description: string | null;
  method: string;
  path_template: string;
  body_template: string | null;
  query_template_json: string;
  response_map_json: string;
  params_json: string | null;
  request_json: string | null;
  response_json: string | null;
  expose_to_ai: number;
  side_effect: string;
  requires_confirm: number;
  test_args_json: string | null;
  sort_order: number;
  auth_mode: string;
  auth_field_key: string | null;
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToOperation(row: OpRow): IntegrationOperationDef {
  const queryTemplate = parseJson<Record<string, string>>(
    row.query_template_json,
    {},
  );
  const responseMap = parseJson(row.response_map_json, { fields: {} });
  const testArgs = row.test_args_json
    ? parseJson<Record<string, unknown>>(row.test_args_json, {})
    : undefined;
  return integrationOperationSchema.parse({
    id: row.id,
    capability: normalizeIntegrationCapability(row.capability),
    slug: row.slug,
    toolName: row.tool_name ?? undefined,
    description: row.description ?? undefined,
    method: row.method,
    pathTemplate: row.path_template,
    bodyTemplate: row.body_template ?? undefined,
    queryTemplate,
    responseMap,
    params: parseJson(row.params_json, []),
    request: row.request_json
      ? parseJson(row.request_json, undefined)
      : undefined,
    response: row.response_json
      ? parseJson(row.response_json, { fields: {} })
      : undefined,
    exposeToAi: row.expose_to_ai === 1,
    sideEffect: row.side_effect,
    requiresConfirm: row.requires_confirm === 1,
    testArgs,
    sortOrder: row.sort_order,
    authMode: row.auth_mode || "inherit",
    authFieldKey: row.auth_field_key ?? undefined,
  });
}

export async function loadOrgIntegrationBundle(
  db: D1Database,
  orgId: string,
  encryptionKey: string | undefined,
  filters?: { kind?: string; instanceId?: string; includePending?: boolean },
): Promise<IntegrationDefinitionBundle | null> {
  const binds: string[] = [orgId];
  let sql = `SELECT i.id as instance_id, i.pinned_version, i.values_enc, i.status,
              d.id as definition_id, d.kind, d.slug, d.version, d.connector_json,
              d.payment_profile_json, d.fields_json
       FROM org_integration_instances i
       JOIN integration_definitions d ON d.id = i.definition_id
       WHERE i.org_id = ? AND i.enabled = 1
         AND d.status = 'active'`;
  if (!filters?.includePending) {
    sql += ` AND i.status = 'connected'`;
  }
  if (filters?.kind) {
    sql += ` AND d.kind = ?`;
    binds.push(filters.kind);
  }
  if (filters?.instanceId) {
    sql += ` AND i.id = ?`;
    binds.push(filters.instanceId);
  }
  sql += ` ORDER BY d.kind LIMIT 1`;

  const row = await db
    .prepare(sql)
    .bind(...binds)
    .first<{
      instance_id: string;
      pinned_version: number;
      values_enc: string | null;
      definition_id: string;
      kind: string;
      slug: string;
      version: number;
      connector_json: string;
      payment_profile_json: string | null;
      fields_json: string;
    }>();

  if (!row) return null;

  const version = row.pinned_version || row.version;
  const opRows = await db
    .prepare(
      `SELECT id, capability, slug, tool_name, description, method, path_template, body_template,
              query_template_json, response_map_json, params_json, request_json, response_json,
              expose_to_ai, side_effect, requires_confirm, test_args_json, sort_order,
              auth_mode, auth_field_key
       FROM integration_operations
       WHERE definition_id = ? AND definition_version = ?
       ORDER BY sort_order, slug`,
    )
    .bind(row.definition_id, version)
    .all<OpRow>();

  const encKey = encryptionKey?.trim();
  if (!row.values_enc || !encKey) return null;
  const plain = await decryptSecret(row.values_enc, encKey);
  if (!plain) return null;
  const values = JSON.parse(plain) as Record<string, string>;

  const fields = parseIntegrationFields(row.fields_json);
  for (const f of fields) {
    if (f.required && !values[f.key]?.trim()) return null;
  }

  let connector = connectorConfigSchema.parse({});
  try {
    connector = connectorConfigSchema.parse(JSON.parse(row.connector_json));
  } catch {
    connector = connectorConfigSchema.parse({});
  }

  let paymentProfile = null;
  if (row.payment_profile_json) {
    try {
      paymentProfile = paymentProfileSchema.parse(
        JSON.parse(row.payment_profile_json),
      );
    } catch {
      paymentProfile = null;
    }
  }

  return {
    definitionId: row.definition_id,
    instanceId: row.instance_id,
    kind: row.kind,
    slug: row.slug,
    version,
    connector,
    paymentProfile,
    operations: (opRows.results ?? []).map(rowToOperation),
    values,
  };
}

export function findOperation(
  bundle: IntegrationDefinitionBundle,
  capability: StandardIntegrationCapability,
): IntegrationOperationDef | undefined {
  const keys = new Set(capabilityMatchKeys(capability));
  return bundle.operations.find((o) => {
    const norm = normalizeIntegrationCapability(String(o.capability));
    return keys.has(String(o.capability)) || norm === capability;
  });
}

export async function executeIntegrationCapability(
  bundle: IntegrationDefinitionBundle,
  capability: StandardIntegrationCapability,
  args: Record<string, string>,
): Promise<HttpEngineResult & { capability: StandardIntegrationCapability }> {
  const op = findOperation(bundle, capability);
  if (!op) return { ok: false, code: "operation_not_found", capability };

  const result = await executeIntegrationOperation(
    bundle.connector,
    op,
    bundle.values,
    args,
  );
  return { ...result, capability };
}

export function mapCatalogItems(
  bodyJson: unknown,
  op: IntegrationOperationDef,
): Array<{
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  stock?: number;
}> {
  const map = effectiveResponseMap(op);
  const path = map.itemsPath ?? "data";
  const max = map.maxItems ?? 48;
  const items = getJsonPath(bodyJson, path);
  if (!Array.isArray(items)) return [];
  const fields = map.itemFields ?? {};
  const out: Array<{
    productId: string;
    name: string;
    priceCents: number;
    currency: string;
    stock?: number;
  }> = [];
  for (const item of items.slice(0, max)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const productId = fields.productId
      ? String(getJsonPath(row, fields.productId) ?? "")
      : String(row.id ?? row.sku ?? "");
    const name = fields.name
      ? String(getJsonPath(row, fields.name) ?? "")
      : String(row.name ?? row.title ?? "");
    const priceRaw = fields.priceCents
      ? getJsonPath(row, fields.priceCents)
      : row.price ?? row.priceCents;
    let priceCents = 0;
    if (typeof priceRaw === "number") {
      priceCents =
        Number.isInteger(priceRaw) && priceRaw >= 100
          ? priceRaw
          : Math.round(priceRaw * 100);
    } else if (typeof priceRaw === "string") {
      const n = Number(priceRaw.replace(/[^\d.,]/g, "").replace(",", "."));
      if (Number.isFinite(n)) priceCents = Math.round(n * 100);
    }
    const currency = fields.currency
      ? String(getJsonPath(row, fields.currency) ?? "COP")
      : "COP";
    if (!productId.trim() || !name.trim()) continue;
    const stockVal = fields.stock ? getJsonPath(row, fields.stock) : undefined;
    out.push({
      productId: productId.slice(0, 64),
      name: name.slice(0, 200),
      priceCents,
      currency: currency.slice(0, 8),
      stock: typeof stockVal === "number" ? stockVal : undefined,
    });
  }
  return out;
}

export async function listOrgActiveCapabilities(
  db: D1Database,
  orgId: string,
): Promise<IntegrationCapability[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT o.capability FROM integration_operations o
       JOIN org_integration_instances i ON i.definition_id = o.definition_id
         AND i.pinned_version = o.definition_version
       WHERE i.org_id = ? AND i.enabled = 1 AND i.status = 'connected'`,
    )
    .bind(orgId)
    .all<{ capability: string }>();
  const caps: IntegrationCapability[] = [];
  for (const r of rows.results ?? []) {
    const norm = normalizeIntegrationCapability(r.capability);
    const p = integrationCapabilitySchema.safeParse(norm);
    if (p.success && p.data !== "custom") caps.push(p.data);
  }
  return caps;
}

export async function loadOrgCommerceCatalogBundle(
  db: D1Database,
  orgId: string,
  encryptionKey: string | undefined,
): Promise<IntegrationDefinitionBundle | null> {
  return loadOrgIntegrationBundle(db, orgId, encryptionKey, {
    kind: "commerce",
  });
}

export async function loadActivePaymentDeclarativeInstance(
  db: D1Database,
  orgId: string,
): Promise<{ instanceId: string; definitionId: string } | null> {
  const row = await db
    .prepare(
      `SELECT i.id, d.id as def_id FROM org_integration_instances i
       JOIN integration_definitions d ON d.id = i.definition_id
       JOIN org_payment_providers p ON p.org_id = i.org_id
       WHERE i.org_id = ? AND i.enabled = 1 AND i.status = 'connected'
         AND d.kind = 'payment' AND p.provider = 'declarative' AND p.status = 'active'
       LIMIT 1`,
    )
    .bind(orgId)
    .first<{ id: string; def_id: string }>();
  if (!row) return null;
  return { instanceId: row.id, definitionId: row.def_id };
}

/** Alias: capacidades activas por org. */
export const loadOrgIntegrationCapabilities = listOrgActiveCapabilities;
