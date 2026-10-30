import { planFromSlug, PLAN_LIMITS } from "@chatbot/domain";
import { decryptSecret } from "./crypto";
import type { AgentTool, McpToolDef } from "./types";

export type McpListResult = {
  tools: AgentTool[];
  listCalls: number;
};

export async function fetchMcpToolsList(
  serverUrl: string,
  headers: Record<string, string>,
): Promise<McpToolDef[]> {
  const res = await fetch(serverUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    result?: {
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }>;
    };
  };
  return (data.result?.tools ?? []).map((t) => ({
    name: `mcp_${t.name}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64),
    description: t.description ?? `MCP tool ${t.name}`,
    inputSchema: t.inputSchema,
    serverUrl,
    serverName: "",
    headers,
  }));
}

export async function syncMcpServerCatalog(
  db: D1Database,
  params: {
    serverId: string;
    botId: string;
    serverUrl: string;
    serverName: string;
    headers: Record<string, string>;
    maxTools: number;
  },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const remote = await fetchMcpToolsList(params.serverUrl, params.headers);
  const capped = remote.slice(0, Math.max(0, params.maxTools));

  await db
    .prepare(`DELETE FROM bot_mcp_tool_catalog WHERE server_id = ?`)
    .bind(params.serverId)
    .run();

  for (const t of capped) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO bot_mcp_tool_catalog (id, server_id, bot_id, tool_name, description_short, input_schema_json, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(
        id,
        params.serverId,
        params.botId,
        t.name,
        (t.description ?? "").slice(0, 500),
        JSON.stringify(t.inputSchema ?? {}),
      )
      .run();
  }

  return { ok: true, count: capped.length };
}

export async function maxMcpToolsForBot(
  db: D1Database,
  botId: string,
): Promise<number> {
  const planRow = await db
    .prepare(
      `SELECT o.plan_slug FROM bots b JOIN orgs o ON o.id = b.org_id WHERE b.id = ?`,
    )
    .bind(botId)
    .first<{ plan_slug: string }>();
  const limits = PLAN_LIMITS[planFromSlug(planRow?.plan_slug ?? "starter")];
  return limits.maxMcpToolsMaterializedPerBot;
}

export async function loadMcpAgentToolsFromCatalog(
  db: D1Database,
  botId: string,
  encryptionKey: string | undefined,
): Promise<McpListResult> {
  const mcpRows = await db
    .prepare(
      `SELECT id, name, server_url, headers_enc FROM bot_mcp_servers WHERE bot_id = ? AND enabled = 1`,
    )
    .bind(botId)
    .all<{
      id: string;
      name: string;
      server_url: string;
      headers_enc: string | null;
    }>();

  const tools: AgentTool[] = [];
  let listCalls = 0;

  for (const mcp of mcpRows.results ?? []) {
    let headers: Record<string, string> = {};
    if (mcp.headers_enc && encryptionKey) {
      const plain = await decryptSecret(mcp.headers_enc, encryptionKey);
      if (plain) {
        try {
          headers = JSON.parse(plain) as Record<string, string>;
        } catch {
          headers = {};
        }
      }
    }

    const catalog = await db
      .prepare(
        `SELECT tool_name, description_short, input_schema_json
         FROM bot_mcp_tool_catalog WHERE server_id = ? ORDER BY tool_name`,
      )
      .bind(mcp.id)
      .all<{
        tool_name: string;
        description_short: string;
        input_schema_json: string;
      }>();

    const rows = catalog.results ?? [];
    if (!rows.length) {
      listCalls += 1;
      const live = await fetchMcpToolsList(mcp.server_url, headers);
      const maxTools = await maxMcpToolsForBot(db, botId);
      for (const t of live.slice(0, maxTools)) {
        tools.push({
          kind: "mcp",
          tool: {
            ...t,
            serverUrl: mcp.server_url,
            serverName: mcp.name,
            headers,
          },
        });
      }
      continue;
    }

    for (const row of rows) {
      let inputSchema: Record<string, unknown> | undefined;
      try {
        inputSchema = JSON.parse(row.input_schema_json) as Record<
          string,
          unknown
        >;
      } catch {
        inputSchema = { type: "object", properties: {} };
      }
      tools.push({
        kind: "mcp",
        tool: {
          name: row.tool_name,
          description: row.description_short,
          inputSchema,
          serverUrl: mcp.server_url,
          serverName: mcp.name,
          headers,
        },
      });
    }
  }

  return { tools, listCalls };
}

export async function getMcpCatalogSyncSummary(
  db: D1Database,
  botId: string,
): Promise<
  Array<{ serverId: string; name: string; toolCount: number; syncedAt: string | null }>
> {
  const servers = await db
    .prepare(
      `SELECT id, name FROM bot_mcp_servers WHERE bot_id = ? ORDER BY name`,
    )
    .bind(botId)
    .all<{ id: string; name: string }>();

  const out: Array<{
    serverId: string;
    name: string;
    toolCount: number;
    syncedAt: string | null;
  }> = [];

  for (const s of servers.results ?? []) {
    const agg = await db
      .prepare(
        `SELECT COUNT(*) as c, MAX(synced_at) as synced_at FROM bot_mcp_tool_catalog WHERE server_id = ?`,
      )
      .bind(s.id)
      .first<{ c: number; synced_at: string | null }>();
    out.push({
      serverId: s.id,
      name: s.name,
      toolCount: agg?.c ?? 0,
      syncedAt: agg?.synced_at ?? null,
    });
  }
  return out;
}
