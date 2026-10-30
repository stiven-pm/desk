import type { AgentTool } from "./types";

export const MAX_TOOLS_PER_TURN = 8;
const MIN_SCORE = 1;
/** Fast path cuando el mensaje alinea claro con pocas tools. */
export const FAST_PATH_MIN_SCORE = 3;

/** Saludos / cierre: chat normal, sin inyectar tools al modelo. */
const SMALL_TALK_RE =
  /^(hola|holaa|qhubo|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hi|hello|qu[eé]\s+tal|gracias|ok|vale|listo|adi[oó]s|chao|bye)[\s!.?]*$/iu;

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

export function isSmallTalkMessage(userMessage: string): boolean {
  const trimmed = userMessage.trim();
  return !trimmed || SMALL_TALK_RE.test(trimmed);
}

export function scoreToolsForMessage(
  tools: AgentTool[],
  userMessage: string,
): Array<{ t: AgentTool; score: number }> {
  if (!tools.length || isSmallTalkMessage(userMessage)) return [];

  const qTokens = new Set(tokenize(userMessage));
  const scored = tools.map((t) => {
    const words = tokenize(toolText(t));
    let score = 0;
    for (const w of words) {
      if (qTokens.has(w)) score += 2;
    }
    const toolBlob = toolText(t);
    if (
      t.kind === "http" &&
      /product|item|order|pedido|cliente|invoice|ticket/i.test(toolBlob)
    ) {
      if (
        /compr|product|pedido|stock|precio|cliente|factura|ticket/i.test(
          userMessage,
        )
      ) {
        score += 3;
      }
      if (/list|search|product|item|catalog/i.test(toolBlob)) {
        score += 2;
      }
    }
    return { t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Solo herramientas con señal en el mensaje; si no hay señal, [] (el chat sigue sin tools). */
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

export function shouldUseToolFastPath(
  tools: AgentTool[],
  userMessage: string,
): AgentTool[] | null {
  const scored = scoreToolsForMessage(tools, userMessage);
  const best = scored[0]?.score ?? 0;
  if (best < FAST_PATH_MIN_SCORE) return null;
  const picked = scored
    .filter((s) => s.score >= MIN_SCORE)
    .slice(0, MAX_TOOLS_PER_TURN)
    .map((s) => s.t);
  return picked.length ? picked : null;
}
