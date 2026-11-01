import type { LlmToolSchema } from "./types";
import type { AgentTool } from "./types";
import { scoreToolsForMessage } from "./tool-rank";
import { executeHttpTool, executeMcpTool } from "./execute";
import { executeDeskIntegrationTool } from "./execute-integration-tool";

export const DESK_SEARCH_INTEGRATIONS = "desk_search_integrations";
export const DESK_CALL_INTEGRATION = "desk_call_integration";

const META_TOOL_NAMES = new Set([
  DESK_SEARCH_INTEGRATIONS,
  DESK_CALL_INTEGRATION,
]);

export function isDeskIntegrationMetaTool(name: string): boolean {
  return META_TOOL_NAMES.has(name);
}

export function deskIntegrationMetaToolSchemas(): LlmToolSchema[] {
  return [
    {
      type: "function",
      function: {
        name: DESK_SEARCH_INTEGRATIONS,
        description:
          "Search business HTTP/MCP integrations by intent (query in the visitor's language). Returns names and short descriptions; then use desk_call_integration or desk_codemode.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "What to look up (invoice, order, stock, etc.).",
            },
            limit: {
              type: "integer",
              description: "Max results (default 8).",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: DESK_CALL_INTEGRATION,
        description:
          "Run an integration by exact name from desk_search_integrations.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Tool name." },
            arguments: {
              type: "object",
              description: "Arguments per the integration schema.",
            },
          },
          required: ["name"],
        },
      },
    },
  ];
}

export function shouldOfferDeskIntegrationMetaTools(
  allTools: AgentTool[],
  rankedCount: number,
): boolean {
  if (allTools.length <= rankedCount) return false;
  return allTools.length > 3;
}

export function runDeskSearchIntegrations(
  allTools: AgentTool[],
  args: Record<string, unknown>,
): string {
  const query = String(args.query ?? "").trim();
  if (!query) {
    return JSON.stringify({ ok: false, error: "missing_query" });
  }
  const limit = Math.min(
    12,
    Math.max(1, Number(args.limit) || 8),
  );
  const scored = scoreToolsForMessage(allTools, query);
  const hits = scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => ({
      name: s.t.tool.name,
      description:
        s.t.kind === "http"
          ? s.t.tool.description.slice(0, 160)
          : s.t.tool.description.slice(0, 160),
    }));
  return JSON.stringify({ ok: true, tools: hits, query });
}

export async function runDeskCallIntegration(
  toolIndex: Map<string, AgentTool>,
  args: Record<string, unknown>,
): Promise<string> {
  const name = String(args.name ?? "").trim();
  if (!name) {
    return JSON.stringify({ ok: false, error: "missing_name" });
  }
  const entry = toolIndex.get(name);
  if (!entry) {
    return JSON.stringify({
      ok: false,
      error: "unknown_integration",
      hint: "Busca de nuevo con desk_search_integrations.",
    });
  }
  const toolArgs = (args.arguments ?? {}) as Record<string, unknown>;
  try {
    if (entry.kind === "http") {
      return await executeHttpTool(entry.tool, toolArgs);
    }
    if (entry.kind === "mcp") {
      return await executeMcpTool(
        entry.tool.serverUrl,
        entry.tool.headers,
        name,
        toolArgs,
      );
    }
    if (entry.kind === "integration") {
      return await executeDeskIntegrationTool(entry.tool, toolArgs);
    }
    return JSON.stringify({ ok: false, error: "unsupported_kind" });
  } catch (e) {
    return JSON.stringify({
      ok: false,
      error: "tool_failed",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
