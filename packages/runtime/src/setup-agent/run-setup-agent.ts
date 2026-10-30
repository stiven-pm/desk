import type { LlmEnv } from "../llm-client";
import { agentLlmTurn } from "../integrations/agent-llm-turn";
import { SETUP_META_TOOL_DEFINITIONS } from "./meta-tool-definitions";
import type { LlmToolSchema } from "../integrations/types";
import {
  harnessSetupVerifyEnabled,
  type HarnessEnv,
} from "../harness/flags";

export type SetupAgentResult = {
  text: string;
  creditsEstimate: number;
  toolCallsUsed: number;
  mutations: number;
  verified: boolean;
};

const DEFAULT_MAX_ROUNDS = 14;
const VERIFY_INJECT =
  "Antes de cerrar: verifica la configuración con desk_workspace_status o desk_probe_http y confirma al admin solo si el JSON es coherente.";

export function buildSetupAgentSystemPrompt(opts: {
  botName: string;
  skillsSection: string;
}): string {
  return `Eres el asistente de **configuración** de Desk para "${opts.botName}".
Hablas solo con el dueño o admin del negocio. Ayudas a conectar sus sistemas y a definir procedimientos;
el chat público de sus clientes no te ve.

Reglas:
- Español claro, sin jerga (evita decir MCP, OpenAPI, meta-tool; di "conexión", "API", "formulario seguro").
- Pide credenciales o URLs cuando falten; usa herramientas desk_* para aplicar cambios.
- No inventes endpoints: usa desk_fetch_docs o desk_probe_http antes de desk_add_http_tool.
- Los secretos van solo en argumentos de herramientas (authSecret, config de conectores); nunca los repitas al usuario en claro.
- Tras conectar algo, ofrece crear un **skill** con el flujo probado y publicarlo (desk_skill_save + desk_skill_publish).
- Para secretos usa **desk_request_credentials** (formulario en panel), no pidas API keys en el mensaje del admin.
- OpenAPI remoto: **desk_import_openapi_url** antes de pedir credenciales de auth.
- Si hace falta Linux/npm real (plan Business): **desk_enterprise_shell_queue**.
- No ejecutas bash en este runtime; solo las herramientas disponibles.
- El chat **público** solo ve instrucciones, RAG, tools publicadas y skills **published** (resumen; usa desk_skill_read para editar el texto completo).
- Después de cambiar conexiones o skills, **comprueba** con desk_workspace_status antes de decir que todo está listo.

${opts.skillsSection ? `${opts.skillsSection}\n` : ""}`.trim();
}

export type SetupMetaToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string>;

export async function runSetupAgent(
  env: LlmEnv & HarnessEnv,
  params: {
    system: string;
    user: string;
    executeMetaTool: SetupMetaToolExecutor;
    maxRounds?: number;
    extraTools?: LlmToolSchema[];
    isMutatingTool?: (name: string) => boolean;
    isVerifyTool?: (name: string) => boolean;
  },
): Promise<SetupAgentResult> {
  const metaTools = [
    ...SETUP_META_TOOL_DEFINITIONS,
    ...(params.extraTools ?? []),
  ];
  type Msg = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    name?: string;
  };

  const messages: Msg[] = [
    { role: "system", content: params.system },
    { role: "user", content: params.user },
  ];

  let totalCredits = 0;
  let toolCallsUsed = 0;
  let mutations = 0;
  let verified = false;
  let verifyAttempts = 0;
  const maxRounds = params.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const verifyEnabled = harnessSetupVerifyEnabled(env);
  const isMutating = params.isMutatingTool ?? (() => false);
  const isVerify = params.isVerifyTool ?? (() => false);

  for (let round = 0; round < maxRounds; round++) {
    const result = await agentLlmTurn(env, {
      messages,
      tools: metaTools,
      allowStream: false,
    });

    if (!result.ok) {
      return {
        text: "No pude completar la configuración ahora. Intenta de nuevo en un momento.",
        creditsEstimate: totalCredits,
        toolCallsUsed,
        mutations,
        verified,
      };
    }
    totalCredits += Math.ceil(
      (result.promptTokens + result.completionTokens) / 4,
    );

    if (!result.toolCalls?.length) {
      const needsVerify =
        verifyEnabled && mutations > 0 && !verified && verifyAttempts < 2;
      if (needsVerify) {
        verifyAttempts += 1;
        messages.push({
          role: "system",
          content: VERIFY_INJECT,
        });
        continue;
      }
      const text = result.content.trim();
      return {
        text: text || "Listo.",
        creditsEstimate: totalCredits,
        toolCallsUsed,
        mutations,
        verified: mutations === 0 || verified,
      };
    }

    messages.push({ role: "assistant", content: result.content || "" });

    for (const call of result.toolCalls) {
      toolCallsUsed += 1;
      let output = JSON.stringify({ error: "unknown_tool" });
      try {
        const args = JSON.parse(call.arguments || "{}") as Record<
          string,
          unknown
        >;
        if (isMutating(call.name)) mutations += 1;
        output = await params.executeMetaTool(call.name, args);
        if (isVerify(call.name)) {
          try {
            const parsed = JSON.parse(output) as { error?: string };
            if (!parsed.error) verified = true;
          } catch {
            verified = true;
          }
        }
      } catch (e) {
        output = JSON.stringify({
          error: e instanceof Error ? e.message : "tool_failed",
        });
      }
      messages.push({
        role: "tool",
        content: output,
        tool_call_id: call.id,
        name: call.name,
      });
    }
  }

  return {
    text:
      "Alcancé el límite de pasos en esta vuelta. Revisa el panel o envía «continúa» para seguir configurando.",
    creditsEstimate: totalCredits,
    toolCallsUsed,
    mutations,
    verified,
  };
}
