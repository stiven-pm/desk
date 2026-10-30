import type { Env } from "../types";
import { llmChatWithMessages } from "@chatbot/runtime/llm-client";

export async function buildHandoffSummary(
  env: Env,
  messages: Array<{ role: string; text: string }>,
): Promise<string> {
  const transcript = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-14)
    .map((m) => {
      const who = m.role === "user" ? "Visitante" : "Asistente";
      return `${who}: ${m.text.replace(/\s+/g, " ").slice(0, 350)}`;
    })
    .join("\n");

  if (!transcript.trim()) {
    return "Necesito ayuda de un asesor.";
  }

  const r = await llmChatWithMessages(env, {
    messages: [
      {
        role: "system",
        content:
          "Eres Desk. Redacta UN mensaje corto (máximo 380 caracteres) que resuma la intención del visitante para un asesor humano. " +
          "Primera persona del cliente. No copies el diálogo literal, no uses formato «Cliente:» / «Asistente:». Español natural.",
      },
      { role: "user", content: transcript },
    ],
  });

  if (r.ok && r.content.trim()) {
    return r.content.trim().replace(/\s+/g, " ").slice(0, 400);
  }

  const lastUser = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text.trim())
    .filter(Boolean)
    .slice(-2)
    .join(" ");
  return lastUser.slice(0, 400) || "Necesito ayuda de un asesor.";
}
