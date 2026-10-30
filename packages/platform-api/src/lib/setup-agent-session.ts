import { harnessCompactHistoryEnabled } from "@chatbot/runtime/harness/flags";
import type { LlmEnv } from "@chatbot/runtime/llm-client";
import { llmChatWithMessages } from "@chatbot/runtime/llm-client";
import type { Env } from "../types";

type HarnessEnv = Env & LlmEnv;

export async function loadSetupRollingSummary(
  db: D1Database,
  botId: string,
  userId: string,
): Promise<string> {
  const row = await db
    .prepare(
      `SELECT rolling_summary FROM bot_setup_sessions WHERE bot_id = ? AND user_id = ?`,
    )
    .bind(botId, userId)
    .first<{ rolling_summary: string }>();
  return row?.rolling_summary?.trim() ?? "";
}

export async function saveSetupRollingSummary(
  db: D1Database,
  botId: string,
  userId: string,
  summary: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bot_setup_sessions (bot_id, user_id, rolling_summary, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(bot_id, user_id) DO UPDATE SET
         rolling_summary = excluded.rolling_summary,
         updated_at = datetime('now')`,
    )
    .bind(botId, userId, summary.slice(0, 8000))
    .run();
}

export function compactSetupHistoryBlock(opts: {
  rollingSummary: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  maxTurns: number;
}): string {
  const recent = opts.history.slice(-opts.maxTurns);
  const lines = recent.map(
    (h) => `${h.role === "user" ? "Admin" : "Setup"}: ${h.content}`,
  );
  const parts: string[] = [];
  if (opts.rollingSummary) {
    parts.push(`Resumen de configuración hasta ahora:\n${opts.rollingSummary}`);
  }
  if (lines.length) {
    parts.push(`Últimos mensajes:\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}

export async function maybeRefreshSetupSummary(
  env: HarnessEnv,
  params: {
    botId: string;
    userId: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    latestAssistant: string;
  },
): Promise<void> {
  if (!harnessCompactHistoryEnabled(env)) return;
  if (params.history.length < 8) return;

  const prev = await loadSetupRollingSummary(env.DB, params.botId, params.userId);
  const transcript = params.history
    .slice(-12)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");

  const r = await llmChatWithMessages(env, {
    messages: [
      {
        role: "system",
        content:
          "Resume en español el estado de configuración del bot (conexiones, skills, pendientes). Máximo 12 líneas. Sin secretos.",
      },
      {
        role: "user",
        content: `Resumen previo:\n${prev || "(ninguno)"}\n\nTranscript:\n${transcript}\n\nÚltima respuesta setup:\n${params.latestAssistant}`,
      },
    ],
  });
  if (!r.ok || !r.content.trim()) return;
  await saveSetupRollingSummary(
    env.DB,
    params.botId,
    params.userId,
    r.content.trim(),
  );
}
