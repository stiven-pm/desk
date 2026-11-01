import type { AgentTool } from "./types";

export const MAX_HTTP_TOOLS_PER_TURN = 5;
/** @deprecated Use MAX_HTTP_TOOLS_PER_TURN */
export const MAX_TOOLS_PER_TURN = MAX_HTTP_TOOLS_PER_TURN;
const MIN_SCORE = 1;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9áéíóúñ]+/i)
    .filter((w) => w.length > 2);
}

function toolText(at: AgentTool): string {
  if (at.kind === "http") {
    return `${at.tool.name} ${at.tool.description}`;
  }
  return `${at.tool.name} ${at.tool.description}`;
}

export function scoreToolsForMessage(
  tools: AgentTool[],
  userMessage: string,
): Array<{ t: AgentTool; score: number }> {
  if (!tools.length || !userMessage.trim()) return [];

  const qTokens = new Set(tokenize(userMessage));
  if (qTokens.size === 0) return [];

  const scored = tools.map((t) => {
    const words = tokenize(toolText(t));
    let score = 0;
    for (const w of words) {
      if (qTokens.has(w)) score += 2;
    }
    return { t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** HTTP/MCP solo si hay overlap de tokens con nombre/descripción; sin listas de palabras. */
export function rankToolsForUserMessage(
  tools: AgentTool[],
  userMessage: string,
): AgentTool[] {
  const scored = scoreToolsForMessage(tools, userMessage);
  const best = scored[0]?.score ?? 0;
  if (best < MIN_SCORE) return [];

  return scored
    .filter((s) => s.score >= MIN_SCORE)
    .slice(0, MAX_TOOLS_PER_TURN)
    .map((s) => s.t);
}
