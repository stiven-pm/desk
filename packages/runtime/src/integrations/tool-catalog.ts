import type { AgentTool } from "./types";
import { scoreToolsForMessage } from "./tool-rank";

export const MAX_CATALOG_LINES_IN_PROMPT = 40;
export const MAX_SCHEMAS_PER_TURN = 8;

export function toolDisplayName(at: AgentTool): string {
  return at.tool.name;
}

export function toolShortDescription(at: AgentTool): string {
  const d =
    at.kind === "http"
      ? at.tool.description
      : at.tool.description;
  return d.slice(0, 120);
}

export function toCatalogLine(at: AgentTool): string {
  return `- ${toolDisplayName(at)}: ${toolShortDescription(at)}`;
}

export function buildCompactCatalogPrompt(
  tools: AgentTool[],
  maxLines = MAX_CATALOG_LINES_IN_PROMPT,
): string {
  if (!tools.length) return "";
  if (tools.length <= maxLines) {
    return `Catálogo de acciones (solo nombres; usa search_tools o select_tools para elegir):\n${tools.map(toCatalogLine).join("\n")}`;
  }
  const names = tools.map((t) => toolDisplayName(t)).slice(0, maxLines);
  return `Hay ${tools.length} acciones conectadas. Usa search_tools con palabras clave del usuario. Primeras: ${names.join(", ")}…`;
}

export function searchToolsInCatalog(
  tools: AgentTool[],
  query: string,
  limit = MAX_SCHEMAS_PER_TURN,
): AgentTool[] {
  const scored = scoreToolsForMessage(tools, query);
  return scored.slice(0, limit).map((s) => s.t);
}

export function selectToolsByName(
  tools: AgentTool[],
  names: string[],
): { selected: AgentTool[]; missing: string[] } {
  const index = new Map(tools.map((t) => [toolDisplayName(t), t]));
  const selected: AgentTool[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const hit = index.get(n);
    if (hit) selected.push(hit);
    else missing.push(n);
  }
  return { selected, missing };
}
