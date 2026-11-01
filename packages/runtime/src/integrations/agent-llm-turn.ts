import { CHAT_DEFAULT_MAX_TOKENS } from "@chatbot/domain";
import type { LlmAttemptLogContext, LlmEnv } from "../llm-client";
import {
  llmChatWithMessages,
  llmChatWithMessagesStream,
  llmStreamingEnabled,
  type LlmChatMessage,
} from "../llm-client";
import { deskTrace, deskTraceEnabled } from "../desk-trace";

type LlmTools = Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}>;

type TurnOk = {
  ok: true;
  content: string;
  promptTokens: number;
  completionTokens: number;
  toolCalls?: import("../llm-client").LlmToolCall[];
  degraded?: boolean;
};

type TurnErr = {
  ok: false;
  reason: "not_configured" | "http_error" | "timeout" | "empty_response";
};

export type AgentLlmTurnResult = TurnOk | TurnErr;

const RETRY_MAX_TOKENS = CHAT_DEFAULT_MAX_TOKENS * 2;

export const AGENT_TOOLS_RETRY_SUFFIX = `

## Tool use (required)
Read the full conversation thread. Infer order refs (RK-…), names, documents, dates, products, and quantities from what the visitor said — the runtime does not pre-parse visitor text for you.
Call the appropriate tools (e.g. commerce_get_order, desk_codemode, commerce_*) with those parameters before answering.
Do not claim you checked orders, stock, or payments without a tool result in this turn.
Use desk_escalate_to_human when handing off; do not claim escalation without that tool.`;

function turnAccepted(
  r: AgentLlmTurnResult,
  tools?: LlmTools,
): r is TurnOk {
  if (!r.ok) return false;
  if (!tools?.length) {
    return Boolean(r.content.trim() || r.toolCalls?.length);
  }
  return Boolean(r.toolCalls?.length);
}

function ladderLog(
  env: LlmEnv,
  step: number,
  r: AgentLlmTurnResult,
  tools?: LlmTools,
  ctx?: LlmAttemptLogContext,
): void {
  console.error(
    JSON.stringify({
      tag: "desk_llm_ladder",
      step,
      result: !r.ok ? r.reason : turnAccepted(r, tools) ? "usable" : "empty",
      toolCount: tools?.length ?? 0,
      at: new Date().toISOString(),
    }),
  );
  if (deskTraceEnabled(env)) {
    deskTrace(
      env,
      "agent.llm_ladder",
      {
        step,
        result: !r.ok ? r.reason : turnAccepted(r, tools) ? "usable" : "empty",
        toolCount: tools?.length ?? 0,
        botId: ctx?.botId,
        conversationId: ctx?.conversationId,
      },
      { botId: ctx?.botId, conversationId: ctx?.conversationId },
    );
  }
}

function withSystemSuffix(
  messages: LlmChatMessage[],
  suffix: string,
): LlmChatMessage[] {
  const out = [...messages];
  if (out[0]?.role === "system") {
    out[0] = { role: "system", content: `${out[0].content}${suffix}` };
  }
  return out;
}

/** Workers AI: stream + tools suele devolver vacío; escalera cambia estrategia en vez de repetir igual. */
export async function agentLlmTurn(
  env: LlmEnv,
  params: {
    messages: LlmChatMessage[];
    tools?: LlmTools;
    allowStream: boolean;
    /** @deprecated Ignorado; tool_choice siempre auto. */
    requireTools?: boolean;
    logContext?: LlmAttemptLogContext;
    onStreamStart?: () => void;
    onDelta?: (chunk: string) => void;
  },
): Promise<AgentLlmTurnResult> {
  const tools = params.tools?.length ? params.tools : undefined;
  const logBase: LlmAttemptLogContext = {
    ...params.logContext,
    ladderStep: 1,
  };

  const canStream =
    params.allowStream &&
    !tools &&
    Boolean(params.onDelta) &&
    llmStreamingEnabled(env);

  if (canStream) {
    params.onStreamStart?.();
    const streamed = await llmChatWithMessagesStream(env, {
      messages: params.messages,
      onDelta: (chunk) => params.onDelta?.(chunk),
    });
    if (
      streamed.ok &&
      (streamed.content.trim() || streamed.toolCalls?.length)
    ) {
      return streamed;
    }
  }

  let r = await llmChatWithMessages(env, {
    messages: params.messages,
    tools,
    logContext: logBase,
  });
  if (turnAccepted(r, tools)) return r;
  ladderLog(env, 1, r, tools, logBase);

  if (
    tools &&
    !(r.ok === false && r.reason === "timeout")
  ) {
    r = await llmChatWithMessages(env, {
      messages: params.messages,
      tools,
      maxTokens: RETRY_MAX_TOKENS,
      logContext: { ...logBase, ladderStep: 2 },
    });
    if (turnAccepted(r, tools)) return r;
    ladderLog(env, 2, r, tools, { ...logBase, ladderStep: 2 });

    r = await llmChatWithMessages(env, {
      messages: withSystemSuffix(params.messages, AGENT_TOOLS_RETRY_SUFFIX),
      tools,
      maxTokens: RETRY_MAX_TOKENS,
      logContext: { ...logBase, ladderStep: 3 },
    });
    if (turnAccepted(r, tools)) {
      ladderLog(env, 3, r, tools, { ...logBase, ladderStep: 3 });
      return r;
    }
    ladderLog(env, 3, r, tools, { ...logBase, ladderStep: 3 });

    r = await llmChatWithMessages(env, {
      messages: params.messages,
      maxTokens: RETRY_MAX_TOKENS,
      logContext: { ...logBase, ladderStep: 4 },
    });
    if (r.ok && r.content.trim()) {
      ladderLog(env, 4, r, tools, { ...logBase, ladderStep: 4 });
      return { ...r, degraded: true };
    }
    ladderLog(env, 4, r, tools, { ...logBase, ladderStep: 4 });
  }

  return r;
}
