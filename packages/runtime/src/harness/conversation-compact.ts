import type { LlmEnv } from "../llm-client";
import { llmChatWithMessages } from "../llm-client";
import { harnessCompactHistoryEnabled, type HarnessEnv } from "./flags";

type CompactEnv = LlmEnv & HarnessEnv;

export async function summarizeVisitorTranscript(
  env: CompactEnv,
  lines: string[],
): Promise<string | null> {
  const r = await llmChatWithMessages(env, {
    messages: [
      {
        role: "system",
        content:
          "Resume la conversación para contexto del asistente. Español, máximo 8 líneas. Sin datos sensibles.",
      },
      { role: "user", content: lines.join("\n") },
    ],
  });
  if (!r.ok || !r.content.trim()) return null;
  return r.content.trim();
}

export function shouldCompactVisitorHistory(
  env: HarnessEnv,
  messageCount: number,
): boolean {
  return harnessCompactHistoryEnabled(env) && messageCount >= 24;
}
