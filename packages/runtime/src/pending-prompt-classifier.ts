import type { PendingPrompt, PendingPromptVerdict } from "@chatbot/domain";
import type { LlmEnv } from "./llm-client";
import { llmChatWithMessages } from "./llm-client";

const VERDICT_WORDS = new Set<PendingPromptVerdict>([
  "accept",
  "decline",
  "other",
]);

export function parsePendingPromptClassifierVerdict(
  raw: string,
): PendingPromptVerdict {
  const first = raw
    .trim()
    .toLowerCase()
    .split(/\s+/)[0]
    ?.replace(/[^a-z]/g, "");
  if (first && VERDICT_WORDS.has(first as PendingPromptVerdict)) {
    return first as PendingPromptVerdict;
  }
  return "other";
}

export async function classifyPendingPromptReply(
  env: LlmEnv,
  pending: PendingPrompt,
  userMessage: string,
): Promise<PendingPromptVerdict> {
  const system = `Clasifica la respuesta del visitante a una oferta del asistente de venta.
Responde con UNA sola palabra en minúsculas: accept, decline, o other.

accept = acepta la oferta (sí, dale, porfa, claro, va, listo, etc.).
decline = rechaza (no, no gracias, después, ahora no).
other = cambia de tema, pregunta otra cosa, insulto, o no responde a la oferta.`;

  const user = `Oferta del asistente: ${pending.offerSummary}
Mensaje del visitante: ${userMessage.trim().slice(0, 500)}`;

  const result = await llmChatWithMessages(env, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  if (!result.ok) return "other";
  return parsePendingPromptClassifierVerdict(result.content);
}
