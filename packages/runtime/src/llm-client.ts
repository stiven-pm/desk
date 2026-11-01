/**
 * Cloudflare Workers AI — sin API keys externas.
 * Modelos por defecto: GLM-5.3-Flash (chat) + BGE-M3 (embeddings).
 */

import { CHAT_DEFAULT_MAX_TOKENS } from "@chatbot/domain";
import {
  deskTraceClip,
  deskTraceLlmVerbose,
  deskTraceMessagesSummary,
  deskTraceToolNames,
} from "./desk-trace";

export const DEFAULT_LLM_TIMEOUT_MS = 45_000;

export const DEFAULT_WORKERS_AI_CHAT_MODEL =
  "@cf/zai-org/glm-5.3-flash";
export const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = "@cf/baai/bge-m3";
/** Dimensión densa de BGE-M3 en Workers AI */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export type LlmAttemptLogContext = {
  botId?: string;
  conversationId?: string;
  ladderStep?: number;
};

export type LlmEnv = {
  AI?: Ai;
  WORKERS_AI_CHAT_MODEL?: string;
  WORKERS_AI_EMBEDDING_MODEL?: string;
  LLM_CHAT_MODEL?: string;
  LLM_EMBEDDING_MODEL?: string;
  LLM_REQUEST_TIMEOUT_MS?: string;
  LLM_STREAM_ENABLED?: string;
  EMBEDDING_DIMENSIONS?: string;
  /** "1" logs truncated request/response on empty AI responses (test only). */
  DESK_LLM_DEBUG?: string;
  /** "1" logs full visitor/agent pipeline as desk_trace JSON lines. */
  DESK_TRACE?: string;
};

export { CHAT_DEFAULT_MAX_TOKENS };

function deskLlmDebugEnabled(env: LlmEnv): boolean {
  return deskTraceLlmVerbose(env);
}

export function resolveLlmTimeoutMs(env: LlmEnv): number {
  const n = Number(env.LLM_REQUEST_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LLM_TIMEOUT_MS;
}

export function llmStreamingEnabled(env: LlmEnv): boolean {
  const v = env.LLM_STREAM_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

export function resolveChatModel(env: LlmEnv): string {
  return (
    env.WORKERS_AI_CHAT_MODEL?.trim() ||
    env.LLM_CHAT_MODEL?.trim() ||
    DEFAULT_WORKERS_AI_CHAT_MODEL
  );
}

export function resolveEmbeddingModel(env: LlmEnv): string {
  return (
    env.WORKERS_AI_EMBEDDING_MODEL?.trim() ||
    env.LLM_EMBEDDING_MODEL?.trim() ||
    DEFAULT_WORKERS_AI_EMBEDDING_MODEL
  );
}

export function embeddingDimensions(env: LlmEnv): number {
  const n = Number(env.EMBEDDING_DIMENSIONS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EMBEDDING_DIMENSIONS;
}

function aiOptions(env: LlmEnv): AiOptions {
  return { signal: AbortSignal.timeout(resolveLlmTimeoutMs(env)) };
}

function workersAiConfigured(env: LlmEnv): boolean {
  return Boolean(env.AI);
}

/** Reasoning models can burn max_tokens on thinking and return content=null. */
export function workersAiChatRequestBody(
  model: string,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const body = { ...base };
  if (/deepseek-v4|deepseek-ai\/deepseek-v4/i.test(model)) {
    body.reasoning_effort = "none";
  } else if (/zai-org\/glm|glm-5\.3-flash/i.test(model)) {
    // GLM maps "none" → max on Workers AI; use explicit low for chat/tools latency.
    body.reasoning_effort = "low";
  }
  return body;
}

function logWorkersAiError(model: string, err: unknown): void {
  console.error(
    JSON.stringify({
      tag: "desk_llm_ai_error",
      model,
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : undefined,
      at: new Date().toISOString(),
    }),
  );
}

function emptyResponseMeta(out: unknown): {
  finish_reason: string | null;
  reasoning_chars: number;
} {
  const o = out as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string };
    }>;
  };
  const choice = o.choices?.[0];
  return {
    finish_reason: choice?.finish_reason ?? null,
    reasoning_chars: choice?.message?.reasoning_content?.length ?? 0,
  };
}

function logWorkersAiEmptyResponse(
  env: LlmEnv,
  model: string,
  out: unknown,
  body: Record<string, unknown>,
  ctx?: LlmAttemptLogContext,
): void {
  const meta = emptyResponseMeta(out);
  console.error(
    JSON.stringify({
      tag: "desk_llm_empty_response",
      model,
      finish_reason: meta.finish_reason,
      reasoning_chars: meta.reasoning_chars,
      botId: ctx?.botId,
      conversationId: ctx?.conversationId,
      ladderStep: ctx?.ladderStep,
      at: new Date().toISOString(),
    }),
  );
  if (deskLlmDebugEnabled(env)) {
    const msgs = (body.messages as Array<{ role?: string; content?: string }>) ?? [];
    console.error(
      JSON.stringify({
        tag: "desk_llm_debug",
        model,
        toolNames: ((body.tools as Array<{ function?: { name?: string } }>) ?? []).map(
          (t) => t.function?.name,
        ),
        roles: msgs.map((m) => m.role),
        systemChars: String(msgs[0]?.content ?? "").length,
        maxTokens: body.max_tokens,
        rawOut: JSON.stringify(out).slice(0, 4000),
        requestBody: JSON.stringify(body).slice(0, 60_000),
      }),
    );
  }
}

function logLlmAttempt(
  env: LlmEnv,
  ctx: LlmAttemptLogContext | undefined,
  model: string,
  meta: {
    durationMs: number;
    toolCount: number;
    ok: boolean;
    reason?: "not_configured" | "http_error" | "timeout" | "empty_response";
    finishReason?: string | null;
    reasoningChars?: number;
    contentLength?: number;
    toolCallNames?: string[];
    messages?: LlmChatMessage[];
    llmToolNames?: string[];
    contentPreview?: string;
  },
): void {
  console.error(
    JSON.stringify({
      tag: "desk_agent_llm_attempt",
      model,
      botId: ctx?.botId,
      conversationId: ctx?.conversationId,
      ladderStep: ctx?.ladderStep ?? null,
      durationMs: meta.durationMs,
      toolCount: meta.toolCount,
      ok: meta.ok,
      reason: meta.ok ? null : meta.reason,
      finishReason: meta.finishReason ?? null,
      reasoningChars: meta.reasoningChars ?? 0,
      contentLength: meta.contentLength ?? 0,
      toolCallNames: meta.toolCallNames ?? [],
      at: new Date().toISOString(),
      ...(deskTraceLlmVerbose(env)
        ? {
            llmToolNames: meta.llmToolNames ?? [],
            messageSummary: deskTraceMessagesSummary(meta.messages ?? []),
            contentPreview: meta.contentPreview ?? "",
          }
        : {}),
    }),
  );
}

export type LlmChatMessageToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: LlmChatMessageToolCall[];
};

function mapMessageForWorkersAi(m: LlmChatMessage): Record<string, unknown> {
  if (m.role === "tool") {
    return {
      role: "tool" as const,
      content: m.content,
      tool_call_id: m.tool_call_id,
      name: m.name,
    };
  }
  if (m.role === "assistant" && m.tool_calls?.length) {
    return {
      role: "assistant" as const,
      content: m.content ?? "",
      tool_calls: m.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
};

function llmTraceAttemptFields(
  env: LlmEnv,
  params: {
    messages: LlmChatMessage[];
    tools?: Array<{ function?: { name?: string } }>;
  },
  content?: string,
): {
  messages?: LlmChatMessage[];
  llmToolNames?: string[];
  contentPreview?: string;
} {
  if (!deskTraceLlmVerbose(env)) return {};
  return {
    messages: params.messages,
    llmToolNames: deskTraceToolNames(params.tools),
    contentPreview: content ? deskTraceClip(content, 400) : "",
  };
}

type ChatOk = {
  ok: true;
  content: string;
  promptTokens: number;
  completionTokens: number;
  toolCalls?: LlmToolCall[];
};
type ChatErr = {
  ok: false;
  reason: "not_configured" | "http_error" | "timeout" | "empty_response";
};

/** Workers AI chat models may return `response` or OpenAI-style `choices`. */
export function extractWorkersAiChatText(out: unknown): string {
  if (!out || typeof out !== "object") return "";
  const o = out as Record<string, unknown>;
  if (typeof o.response === "string" && o.response.trim()) {
    return o.response.trim();
  }
  const choices = o.choices as
    | Array<{ message?: { content?: string }; text?: string }>
    | undefined;
  const first = choices?.[0];
  if (typeof first?.message?.content === "string" && first.message.content.trim()) {
    return first.message.content.trim();
  }
  if (typeof first?.text === "string" && first.text.trim()) {
    return first.text.trim();
  }
  if (typeof o.result === "string" && o.result.trim()) {
    return o.result.trim();
  }
  if (o.result && typeof o.result === "object") {
    const nested = extractWorkersAiChatText(o.result);
    if (nested) return nested;
  }
  if (typeof o.generated_text === "string" && o.generated_text.trim()) {
    return o.generated_text.trim();
  }
  const output = o.output;
  if (typeof output === "string" && output.trim()) {
    return output.trim();
  }
  return "";
}

type WorkersAiRawToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
  name?: string;
  arguments?: string;
};

function mapWorkersAiRawToolCalls(
  raw: WorkersAiRawToolCall[] | undefined,
): LlmToolCall[] | undefined {
  if (!raw?.length) return undefined;
  return raw.map((tc, i) => ({
    id: tc.id ?? `call_${i}`,
    name: tc.function?.name ?? tc.name ?? "unknown",
    arguments: tc.function?.arguments ?? tc.arguments ?? "{}",
  }));
}

/** OpenAI-style `choices[].message.tool_calls` and legacy top-level `tool_calls`. */
export function extractWorkersAiToolCalls(
  out: unknown,
  allowedToolNames?: Set<string>,
): LlmToolCall[] | undefined {
  if (!out || typeof out !== "object") return undefined;
  const o = out as Record<string, unknown>;

  let mapped =
    mapWorkersAiRawToolCalls(o.tool_calls as WorkersAiRawToolCall[] | undefined) ??
    mapWorkersAiRawToolCalls(
      (
        o.choices as
          | Array<{ message?: { tool_calls?: WorkersAiRawToolCall[] } }>
          | undefined
      )?.[0]?.message?.tool_calls,
    );

  if (!mapped?.length && o.result && typeof o.result === "object") {
    mapped = extractWorkersAiToolCalls(o.result, allowedToolNames);
  }

  return filterToolCallsByAllowlist(mapped ?? [], allowedToolNames);
}

function readBalancedJsonObject(source: string, openBraceIndex: number): string | null {
  if (source[openBraceIndex] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  return null;
}

function parseInlineFunctionToolCalls(
  content: string,
  allowedToolNames?: Set<string>,
): LlmToolCall[] | undefined {
  if (!content.trim() || !allowedToolNames?.size) return undefined;
  const calls: LlmToolCall[] = [];
  for (const name of allowedToolNames) {
    const needle = `${name}(`;
    let idx = 0;
    while (idx < content.length) {
      const at = content.indexOf(needle, idx);
      if (at < 0) break;
      const braceAt = content.indexOf("{", at + needle.length);
      if (braceAt < 0) {
        idx = at + needle.length;
        continue;
      }
      const argsJson = readBalancedJsonObject(content, braceAt);
      if (argsJson) {
        try {
          JSON.parse(argsJson);
          calls.push({
            id: crypto.randomUUID(),
            name,
            arguments: argsJson,
          });
          idx = braceAt + argsJson.length;
          continue;
        } catch {
          /* invalid JSON */
        }
      }
      idx = at + needle.length;
    }
  }
  return calls.length ? calls : undefined;
}

function logToolParsedFromText(
  ctx: LlmAttemptLogContext | undefined,
  model: string,
  toolNames: string[],
): void {
  if (!toolNames.length) return;
  console.error(
    JSON.stringify({
      tag: "desk_tool_parsed_from_text",
      model,
      botId: ctx?.botId,
      conversationId: ctx?.conversationId,
      ladderStep: ctx?.ladderStep ?? null,
      toolNames,
      at: new Date().toISOString(),
    }),
  );
}

function filterToolCallsByAllowlist(
  calls: LlmToolCall[],
  allowedToolNames: Set<string> | undefined,
): LlmToolCall[] | undefined {
  if (!calls.length) return undefined;
  if (!allowedToolNames?.size) return calls;
  const filtered = calls.filter((c) => allowedToolNames.has(c.name));
  return filtered.length ? filtered : undefined;
}

/** Solo texto de salida del asistente (Workers AI); opcional allowlist del turno. */
export function parseToolCallsFromContent(
  content: string,
  allowedToolNames?: Set<string>,
): LlmToolCall[] | undefined {
  const inline = parseInlineFunctionToolCalls(content, allowedToolNames);
  if (inline?.length) {
    return filterToolCallsByAllowlist(inline, allowedToolNames);
  }
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  let raw = fenced?.[1]?.trim() ?? content.trim();
  if (!raw.startsWith("{")) {
    const inline = content.match(/\{[\s\S]*"tool(?:_calls)?"[\s\S]*\}/);
    raw = inline?.[0]?.trim() ?? raw;
  }
  if (!raw.startsWith("{")) return undefined;
  try {
    const j = JSON.parse(raw) as {
      tool?: string;
      name?: string;
      arguments?: Record<string, unknown>;
      tool_calls?: Array<{
        id?: string;
        name?: string;
        function?: { name?: string; arguments?: string };
        arguments?: string;
      }>;
    };
    if (j.tool_calls?.length) {
      const mapped: LlmToolCall[] = j.tool_calls.map((tc, i) => ({
        id: tc.id ?? `parsed_${i}`,
        name: tc.function?.name ?? tc.name ?? "unknown",
        arguments:
          tc.function?.arguments ??
          (typeof tc.arguments === "string"
            ? tc.arguments
            : JSON.stringify(tc.arguments ?? {})),
      }));
      return filterToolCallsByAllowlist(mapped, allowedToolNames);
    }
    const name = j.tool ?? j.name;
    if (name) {
      const single: LlmToolCall[] = [
        {
          id: crypto.randomUUID(),
          name,
          arguments: JSON.stringify(j.arguments ?? {}),
        },
      ];
      return filterToolCallsByAllowlist(single, allowedToolNames);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const LLM_RETRY_DELAY_MS = 450;

function llmFailureReasonRetryable(
  reason: ChatErr["reason"],
): boolean {
  return reason === "http_error" || reason === "timeout";
}

async function delayMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function llmChatWithMessages(
  env: LlmEnv,
  params: {
    messages: LlmChatMessage[];
    tools?: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
    maxTokens?: number;
    logContext?: LlmAttemptLogContext;
  },
): Promise<ChatOk | ChatErr> {
  const run = (): Promise<ChatOk | ChatErr> =>
    llmChatWithMessagesOnce(env, params);
  let result = await run();
  if (!result.ok && llmFailureReasonRetryable(result.reason)) {
    await delayMs(LLM_RETRY_DELAY_MS);
    result = await run();
  }
  return result;
}

async function llmChatWithMessagesOnce(
  env: LlmEnv,
  params: {
    messages: LlmChatMessage[];
    tools?: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
    maxTokens?: number;
    logContext?: LlmAttemptLogContext;
  },
): Promise<ChatOk | ChatErr> {
  if (!workersAiConfigured(env)) return { ok: false, reason: "not_configured" };

  const model = resolveChatModel(env);
  const started = Date.now();
  const aiMessages = params.messages.map(mapMessageForWorkersAi);

  try {
    const body: Record<string, unknown> = {
      messages: aiMessages,
      max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS,
    };
    if (params.tools?.length) {
      body.tools = params.tools;
      body.tool_choice = "auto";
    }

    const out = await env.AI!.run(
      model,
      workersAiChatRequestBody(model, body),
      aiOptions(env),
    );

    const data = out as { usage?: UsageTags };

    const allowedToolNames = params.tools?.length
      ? new Set(params.tools.map((t) => t.function.name))
      : undefined;

    let toolCalls = extractWorkersAiToolCalls(out, allowedToolNames);
    if (!toolCalls?.length) {
      const parsed = parseToolCallsFromContent(
        extractWorkersAiChatText(out),
        allowedToolNames,
      );
      if (parsed?.length) {
        logToolParsedFromText(
          params.logContext,
          model,
          parsed.map((t) => t.name),
        );
        toolCalls = parsed;
      }
    }

    const content = extractWorkersAiChatText(out);
    const durationMs = Date.now() - started;
    const emptyMeta = emptyResponseMeta(out);
    if (!content && !toolCalls?.length) {
      logWorkersAiEmptyResponse(env, model, out, body, params.logContext);
      logLlmAttempt(env, params.logContext, model, {
        durationMs,
        toolCount: params.tools?.length ?? 0,
        ok: false,
        reason: "empty_response",
        finishReason: emptyMeta.finish_reason,
        reasoningChars: emptyMeta.reasoning_chars,
        contentLength: 0,
        toolCallNames: [],
        ...llmTraceAttemptFields(env, params),
      });
      return { ok: false, reason: "empty_response" };
    }
    logLlmAttempt(env, params.logContext, model, {
      durationMs,
      toolCount: params.tools?.length ?? 0,
      ok: true,
      finishReason: emptyMeta.finish_reason,
      reasoningChars: emptyMeta.reasoning_chars,
      contentLength: content.length,
      toolCallNames: toolCalls?.map((t) => t.name) ?? [],
      ...llmTraceAttemptFields(env, params, content),
    });
    return {
      ok: true,
      content,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      toolCalls,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    if (e instanceof Error && e.name === "TimeoutError") {
      logLlmAttempt(env, params.logContext, model, {
        durationMs,
        toolCount: params.tools?.length ?? 0,
        ok: false,
        reason: "timeout",
        ...llmTraceAttemptFields(env, params),
      });
      return { ok: false, reason: "timeout" };
    }
    logWorkersAiError(model, e);
    logLlmAttempt(env, params.logContext, model, {
      durationMs,
      toolCount: params.tools?.length ?? 0,
      ok: false,
      reason: "http_error",
      ...llmTraceAttemptFields(env, params),
    });
    return { ok: false, reason: "http_error" };
  }
}

export async function llmChatCompletion(
  env: LlmEnv,
  params: {
    system: string;
    user: string;
    maxTokens?: number;
  },
): Promise<ChatOk | ChatErr> {
  const run = (): Promise<ChatOk | ChatErr> => llmChatCompletionOnce(env, params);
  let result = await run();
  if (!result.ok && llmFailureReasonRetryable(result.reason)) {
    await delayMs(LLM_RETRY_DELAY_MS);
    result = await run();
  }
  return result;
}

async function llmChatCompletionOnce(
  env: LlmEnv,
  params: {
    system: string;
    user: string;
    maxTokens?: number;
  },
): Promise<ChatOk | ChatErr> {
  if (!workersAiConfigured(env)) return { ok: false, reason: "not_configured" };

  const model = resolveChatModel(env);
  try {
    const out = await env.AI!.run(
      model,
      workersAiChatRequestBody(model, {
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS,
      }),
      aiOptions(env),
    );

    const data = out as { usage?: UsageTags };
    const content = extractWorkersAiChatText(out);
    if (!content) {
      logWorkersAiEmptyResponse(env, model, out, {
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS,
      });
      return { ok: false, reason: "empty_response" };
    }
    return {
      ok: true,
      content,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    logWorkersAiError(model, e);
    return { ok: false, reason: "http_error" };
  }
}

type WorkersAiStreamChunk = {
  response?: string;
  choices?: Array<{
    delta?: { content?: string; tool_calls?: WorkersAiRawToolCall[] };
    message?: { tool_calls?: WorkersAiRawToolCall[] };
    text?: string;
  }>;
  tool_calls?: WorkersAiRawToolCall[];
};

function toolCallsFromStreamChunk(j: WorkersAiStreamChunk): LlmToolCall[] | undefined {
  return (
    mapWorkersAiRawToolCalls(j.tool_calls) ??
    mapWorkersAiRawToolCalls(j.choices?.[0]?.delta?.tool_calls) ??
    mapWorkersAiRawToolCalls(j.choices?.[0]?.message?.tool_calls)
  );
}

function extractWorkersAiStreamDelta(
  raw: string,
  cumulativeResponse: { value: string },
): string {
  if (!raw || raw === "[DONE]") return "";
  try {
    const j = JSON.parse(raw) as WorkersAiStreamChunk;
    if (typeof j.response === "string" && j.response) {
      const resp = j.response;
      if (
        resp.length >= cumulativeResponse.value.length &&
        resp.startsWith(cumulativeResponse.value)
      ) {
        const piece = resp.slice(cumulativeResponse.value.length);
        cumulativeResponse.value = resp;
        return piece;
      }
      cumulativeResponse.value += resp;
      return resp;
    }
    const choice = j.choices?.[0];
    if (typeof choice?.delta?.content === "string" && choice.delta.content) {
      return choice.delta.content;
    }
    if (typeof choice?.text === "string" && choice.text) return choice.text;
  } catch {
    return raw;
  }
  return "";
}

type WorkersAiStreamResult = {
  content: string;
  toolCalls?: LlmToolCall[];
};

async function readWorkersAiStream(
  stream: ReadableStream,
  onDelta: (chunk: string) => void | Promise<void>,
  opts?: {
    allowedToolNames?: Set<string>;
    model?: string;
    logContext?: LlmAttemptLogContext;
  },
): Promise<WorkersAiStreamResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let toolCalls: LlmToolCall[] | undefined;
  const cumulativeResponse = { value: "" };

  const emit = async (raw: string) => {
    if (!raw || raw === "[DONE]") return;
    try {
      const j = JSON.parse(raw) as WorkersAiStreamChunk;
      const fromChunk = toolCallsFromStreamChunk(j);
      if (fromChunk?.length) toolCalls = fromChunk;
    } catch {
      // not JSON — fall through to delta extraction
    }
    const piece = extractWorkersAiStreamDelta(raw, cumulativeResponse);
    if (!piece) return;
    full += piece;
    await onDelta(piece);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line) continue;
      if (line.startsWith("data:")) {
        await emit(line.slice(5).trim());
      } else {
        await emit(line);
      }
    }
  }

  if (buffer.trim()) {
    await emit(buffer.trim());
  }

  const content = full.trim();
  let parsedTools = parseToolCallsFromContent(
    content,
    opts?.allowedToolNames,
  );
  if (parsedTools?.length && !toolCalls?.length) {
    logToolParsedFromText(
      opts?.logContext,
      opts?.model ?? "",
      parsedTools.map((t) => t.name),
    );
  } else if (toolCalls?.length) {
    parsedTools = undefined;
  }
  return {
    content,
    toolCalls: toolCalls?.length ? toolCalls : parsedTools,
  };
}

export async function llmChatWithMessagesStream(
  env: LlmEnv,
  params: {
    messages: LlmChatMessage[];
    tools?: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
    maxTokens?: number;
    onDelta: (chunk: string) => void | Promise<void>;
  },
): Promise<ChatOk | ChatErr> {
  if (!workersAiConfigured(env)) return { ok: false, reason: "not_configured" };

  const model = resolveChatModel(env);
  const aiMessages = params.messages.map(mapMessageForWorkersAi);

  try {
    const body: Record<string, unknown> = {
      messages: aiMessages,
      max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS,
      stream: true,
    };
    if (params.tools?.length) {
      body.tools = params.tools;
      body.tool_choice = "auto";
    }

    const allowedToolNames = params.tools?.length
      ? new Set(params.tools.map((t) => t.function.name))
      : undefined;

    const stream = (await env.AI!.run(
      model,
      workersAiChatRequestBody(model, body),
      aiOptions(env),
    )) as unknown as ReadableStream<Uint8Array>;

    const parsed = await readWorkersAiStream(stream, params.onDelta, {
      allowedToolNames,
      model,
    });
    const finalText = parsed.content || "";
    if (!finalText && !parsed.toolCalls?.length) {
      logWorkersAiEmptyResponse(
        env,
        model,
        { stream_empty: true },
        { messages: aiMessages, max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS },
      );
      return { ok: false, reason: "empty_response" };
    }
    return {
      ok: true,
      content: finalText,
      promptTokens: 0,
      completionTokens: Math.ceil(finalText.length / 4),
      toolCalls: parsed.toolCalls,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    logWorkersAiError(model, e);
    return { ok: false, reason: "http_error" };
  }
}

export async function llmChatCompletionStream(
  env: LlmEnv,
  params: {
    system: string;
    user: string;
    maxTokens?: number;
    onDelta: (chunk: string) => void | Promise<void>;
  },
): Promise<ChatOk | ChatErr> {
  if (!workersAiConfigured(env)) return { ok: false, reason: "not_configured" };

  const model = resolveChatModel(env);
  try {
    const stream = (await env.AI!.run(
      model,
      workersAiChatRequestBody(model, {
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS,
        stream: true,
      }),
      aiOptions(env),
    )) as unknown as ReadableStream<Uint8Array>;

    const parsed = await readWorkersAiStream(stream, params.onDelta);
    if (!parsed.content.trim()) {
      logWorkersAiEmptyResponse(
        env,
        model,
        { stream_empty: true },
        {
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          max_tokens: params.maxTokens ?? CHAT_DEFAULT_MAX_TOKENS,
        },
      );
      return { ok: false, reason: "empty_response" };
    }
    return {
      ok: true,
      content: parsed.content,
      promptTokens: 0,
      completionTokens: Math.ceil(parsed.content.length / 4),
    };
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    logWorkersAiError(model, e);
    return { ok: false, reason: "http_error" };
  }
}

function parseBgeEmbeddingResult(
  result: unknown,
  expected: number,
): number[][] | null {
  const r = result as {
    data?: number[][] | number[];
    shape?: number[];
  };
  if (Array.isArray(r.data)) {
    if (r.data.length === 0) return null;
    if (typeof r.data[0] === "number") {
      return [r.data as number[]];
    }
    const rows = r.data as number[][];
    if (rows.length === expected) return rows;
    if (rows.length === 1 && expected === 1) return rows;
  }
  return null;
}

export async function llmEmbeddings(
  env: LlmEnv,
  texts: string[],
): Promise<number[][] | null> {
  if (!texts.length) return [];
  if (!workersAiConfigured(env)) return null;

  const model = resolveEmbeddingModel(env);
  const out: number[][] = [];

  try {
    for (const text of texts) {
      const result = await env.AI!.run(
        model,
        { text: text.slice(0, 8000) },
        aiOptions(env),
      );
      const parsed = parseBgeEmbeddingResult(result, 1);
      const vec = parsed?.[0];
      if (!vec?.length) return null;
      out.push(vec);
    }
    return out;
  } catch {
    return null;
  }
}

export async function llmEmbedding(
  env: LlmEnv,
  text: string,
): Promise<number[] | null> {
  const batch = await llmEmbeddings(env, [text]);
  return batch?.[0] ?? null;
}

type UsageTags = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};
