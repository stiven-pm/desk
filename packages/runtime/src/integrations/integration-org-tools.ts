import {
  buildLlmInputSchemaFromParams,
  integrationOperationLlmName,
  integrationOperationSchema,
  type IntegrationOperationDef,
} from "@chatbot/domain";
import { decryptSecret } from "./crypto";
import type { AgentTool, DeskIntegrationTool } from "./types";
import {
  loadOrgIntegrationBundle,
  type IntegrationDefinitionBundle,
} from "./integration-runtime";

type ExposedOpRow = {
  instance_id: string;
  definition_id: string;
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
  params_json: string;
  request_json: string | null;
  response_json: string | null;
  expose_to_ai: number;
  side_effect: string;
  requires_confirm: number;
  test_args_json: string | null;
  sort_order: number;
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToOperation(row: ExposedOpRow): IntegrationOperationDef | null {
  const parsed = integrationOperationSchema.safeParse({
    id: row.id,
    capability: row.capability,
    slug: row.slug,
    toolName: row.tool_name ?? undefined,
    description: row.description ?? undefined,
    method: row.method,
    pathTemplate: row.path_template,
    bodyTemplate: row.body_template ?? undefined,
    queryTemplate: parseJson(row.query_template_json, {}),
    responseMap: parseJson(row.response_map_json, { fields: {} }),
    params: parseJson(row.params_json, []),
    request: row.request_json ? parseJson(row.request_json, undefined) : undefined,
    response: row.response_json
      ? parseJson(row.response_json, { fields: {} })
      : undefined,
    exposeToAi: row.expose_to_ai === 1,
    sideEffect: row.side_effect,
    requiresConfirm: row.requires_confirm === 1,
    testArgs: row.test_args_json
      ? parseJson(row.test_args_json, undefined)
      : undefined,
    sortOrder: row.sort_order,
  });
  return parsed.success ? parsed.data : null;
}

export async function loadOrgIntegrationTools(
  db: D1Database,
  orgId: string,
  encryptionKey: string | undefined,
): Promise<AgentTool[]> {
  const encKey = encryptionKey?.trim();
  if (!encKey) return [];

  const rows = await db
    .prepare(
      `SELECT i.id as instance_id, i.definition_id, i.pinned_version, i.values_enc,
              o.id, o.capability, o.slug, o.tool_name, o.description, o.method,
              o.path_template, o.body_template, o.query_template_json,
              o.response_map_json, o.params_json, o.request_json, o.response_json,
              o.expose_to_ai, o.side_effect, o.requires_confirm, o.test_args_json, o.sort_order
       FROM org_integration_instances i
       JOIN integration_definitions d ON d.id = i.definition_id AND d.status = 'active'
       JOIN integration_operations o ON o.definition_id = i.definition_id
         AND o.definition_version = COALESCE(NULLIF(i.pinned_version, 0), d.version)
       WHERE i.org_id = ? AND i.enabled = 1 AND i.status = 'connected'
         AND o.expose_to_ai = 1
       ORDER BY i.id, o.sort_order, o.slug`,
    )
    .bind(orgId)
    .all<ExposedOpRow & { values_enc: string; pinned_version: number }>();

  const bundleCache = new Map<string, IntegrationDefinitionBundle | null>();
  const tools: AgentTool[] = [];
  const usedNames = new Set<string>();

  for (const row of rows.results ?? []) {
    const op = rowToOperation(row);
    if (!op) continue;

    let bundle = bundleCache.get(row.instance_id);
    if (bundle === undefined) {
      bundle = await loadOrgIntegrationBundle(db, orgId, encKey, {
        instanceId: row.instance_id,
      });
      bundleCache.set(row.instance_id, bundle);
    }
    if (!bundle) continue;

    const name = integrationOperationLlmName(op);
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const deskTool: DeskIntegrationTool = {
      id: op.id ?? row.id,
      name,
      description:
        op.description?.trim() ||
        `Integración ${bundle.slug}: ${op.slug}`,
      operation: op,
      instanceId: row.instance_id,
      connector: bundle.connector,
      fieldValues: bundle.values,
      requiresConfirm: op.requiresConfirm,
      inputSchema: buildLlmInputSchemaFromParams(op.params ?? []),
    };
    tools.push({ kind: "integration", tool: deskTool });
  }

  return tools;
}
