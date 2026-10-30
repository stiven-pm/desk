import type { LlmEnv } from "../llm-client";
import {
  llmChatWithMessages,
  llmChatWithMessagesStream,
  llmStreamingEnabled,
  type LlmChatMessage,
} from "../llm-client";

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
};

type TurnErr = { ok: false; reason: "not_configured" | "http_error" | "timeout" | "empty_response" };

export type AgentLlmTurnResult = TurnOk | TurnErr;

/** Workers AI: stream + tools suele devolver vacío; tools solo en llamada no-stream. */
export async function agentLlmTurn(
  env: LlmEnv,
  params: {
    messages: LlmChatMessage[];
    tools?: LlmTools;
    allowStream: boolean;
    requireTools?: boolean;
    onStreamStart?: () => void;
    onDelta?: (chunk: string) => void;
  },
): Promise<AgentLlmTurnResult> {
  const tools = params.tools?.length ? params.tools : undefined;
  const requireTools = Boolean(params.requireTools && tools);
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

  let result = await llmChatWithMessages(env, {
    messages: params.messages,
    tools,
  });

  const needsRetry =
    !result.ok ||
    (result.ok && !result.content.trim() && !result.toolCalls?.length);

  if (needsRetry && tools) {
    if (requireTools) {
      result = await llmChatWithMessages(env, {
        messages: params.messages,
        tools,
      });
    } else {
      const withoutTools = await llmChatWithMessages(env, {
        messages: params.messages,
      });
      if (
        withoutTools.ok &&
        (withoutTools.content.trim() || withoutTools.toolCalls?.length)
      ) {
        return withoutTools;
      }
    }
  }

  if (
    result.ok &&
    !result.content.trim() &&
    !result.toolCalls?.length
  ) {
    result = await llmChatWithMessages(env, {
      messages: params.messages,
      tools,
    });
  }

  return result;
}
