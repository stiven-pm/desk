import {
  fetchMcpToolsList,
  maxMcpToolsForBot,
  syncMcpServerCatalog,
} from "@chatbot/runtime/integrations/mcp-catalog";
import { decryptSecret } from "./crypto";
import type { Env } from "../types";

export async function refreshMcpServerCatalog(
  env: Env,
  params: {
    botId: string;
    serverId: string;
    encryptionKey: string;
  },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const row = await env.DB.prepare(
    `SELECT name, server_url, headers_enc FROM bot_mcp_servers WHERE id = ? AND bot_id = ?`,
  )
    .bind(params.serverId, params.botId)
    .first<{
      name: string;
      server_url: string;
      headers_enc: string | null;
    }>();
  if (!row) return { ok: false, error: "not_found" };

  let headers: Record<string, string> = {};
  if (row.headers_enc) {
    const plain = await decryptSecret(row.headers_enc, params.encryptionKey);
    if (plain) {
      try {
        headers = JSON.parse(plain) as Record<string, string>;
      } catch {
        headers = {};
      }
    }
  }

  const maxTools = await maxMcpToolsForBot(env.DB, params.botId);
  return syncMcpServerCatalog(env.DB, {
    serverId: params.serverId,
    botId: params.botId,
    serverUrl: row.server_url,
    serverName: row.name,
    headers,
    maxTools,
  });
}

export async function syncMcpServerAfterUpsert(
  env: Env,
  botId: string,
  serverId: string,
  encryptionKey: string,
): Promise<void> {
  await refreshMcpServerCatalog(env, {
    botId,
    serverId,
    encryptionKey,
  });
}

export { fetchMcpToolsList, getMcpCatalogSyncSummary } from "@chatbot/runtime/integrations/mcp-catalog";
