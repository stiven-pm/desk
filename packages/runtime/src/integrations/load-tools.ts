import { planAllowsIntegrations, planFromSlug, PLAN_LIMITS } from "@chatbot/domain";
import { decryptSecret } from "./crypto";
import { ensureSiigoTokensFresh } from "./siigo-refresh";
import { loadMcpAgentToolsFromCatalog } from "./mcp-catalog";
import type { AgentTool, BotHttpTool } from "./types";
import { loadOrgIntegrationTools } from "./integration-org-tools";

type Row = {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  parameters_json: string;
  base_url: string;
  auth_type: string;
  auth_header_name: string | null;
  auth_secret_enc: string | null;
  headers_json: string | null;
};

export type LoadToolsStats = {
  mcpListCalls: number;
};

export async function loadBotAgentTools(
  db: D1Database,
  botId: string,
  encryptionKey: string | undefined,
  stats?: LoadToolsStats,
): Promise<AgentTool[]> {
  const planRow = await db
    .prepare(
      `SELECT o.plan_slug, o.id as org_id FROM bots b
       JOIN orgs o ON o.id = b.org_id
       WHERE b.id = ?`,
    )
    .bind(botId)
    .first<{ plan_slug: string; org_id: string }>();
  const limits = PLAN_LIMITS[planFromSlug(planRow?.plan_slug ?? "starter")];
  if (!planAllowsIntegrations(limits)) {
    return [];
  }

  await ensureSiigoTokensFresh(db, botId, encryptionKey);

  const tools: AgentTool[] = [];

  const deskIntegrationCount = planRow?.org_id
    ? await db
        .prepare(
          `SELECT COUNT(*) as c FROM org_integration_instances WHERE org_id = ? AND enabled = 1`,
        )
        .bind(planRow.org_id)
        .first<{ c: number }>()
    : null;
  const skipLegacyHttp = (deskIntegrationCount?.c ?? 0) > 0;

  const httpRows = skipLegacyHttp
    ? { results: [] as Row[] }
    : await db
    .prepare(
      `SELECT t.id, t.name, t.description, t.method, t.path, t.parameters_json,
              COALESCE(NULLIF(t.base_url, ''), o.base_url) as base_url,
              CASE
                WHEN t.auth_secret_enc IS NOT NULL AND t.auth_secret_enc != '' THEN t.auth_type
                ELSE COALESCE(o.auth_type, 'none')
              END as auth_type,
              COALESCE(t.auth_header_name, o.auth_header_name) as auth_header_name,
              COALESCE(t.auth_secret_enc, o.auth_secret_enc) as auth_secret_enc,
              t.headers_json
       FROM bot_http_tools t
       LEFT JOIN bot_openapi_configs o ON o.id = t.openapi_config_id AND o.enabled = 1
       WHERE t.bot_id = ? AND t.enabled = 1`,
      )
      .bind(botId)
      .all<Row>();

  for (const row of httpRows.results ?? []) {
    let authSecret: string | undefined;
    if (row.auth_secret_enc && encryptionKey) {
      authSecret =
        (await decryptSecret(row.auth_secret_enc, encryptionKey)) ?? undefined;
    }
    const manualBase = row.base_url || "";
    let extraHeaders: Record<string, string> | undefined;
    if (row.headers_json) {
      try {
        extraHeaders = JSON.parse(row.headers_json) as Record<string, string>;
      } catch {
        extraHeaders = undefined;
      }
    }
    const tool: BotHttpTool = {
      id: row.id,
      name: row.name,
      description: row.description,
      method: row.method,
      path: row.path,
      parameters: JSON.parse(row.parameters_json || "[]"),
      baseUrl: manualBase,
      authType: (row.auth_type as BotHttpTool["authType"]) || "none",
      authHeaderName: row.auth_header_name ?? undefined,
      authSecret,
      extraHeaders,
    };
    if (!tool.baseUrl && tool.path.startsWith("http")) {
      try {
        const u = new URL(tool.path);
        tool.baseUrl = u.origin;
        tool.path = u.pathname + u.search;
      } catch {
        continue;
      }
    }
    if (!tool.baseUrl) continue;
    tools.push({ kind: "http", tool });
  }

  const mcp = await loadMcpAgentToolsFromCatalog(db, botId, encryptionKey);
  if (stats) stats.mcpListCalls = mcp.listCalls;
  tools.push(...mcp.tools);

  if (planRow?.org_id) {
    const deskTools = await loadOrgIntegrationTools(
      db,
      planRow.org_id,
      encryptionKey,
    );
    tools.push(...deskTools);
  }

  return tools;
}
