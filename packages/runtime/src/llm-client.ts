/**
 * Cloudflare Workers AI — sin API keys externas.
 * Modelos por defecto: GLM-5.3-Flash (chat) + BGE-M3 (embeddings).
 */

import { CHAT_DEFAULT_MAX_TOKENS } from "@chatbot/domain";

export const DEFAULT_LLM_TIMEOUT_MS = 45_000;

export const DEFAULT_WORKERS_AI_CHAT_MODEL =
  "@cf/zai-org/glm-5.3-flash";
export const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = "@cf/baai/bge-m3";
/** Dimensión densa de BGE-M3 en Workers AI */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;

export type LlmEnv = {
  AI?: Ai;
  WORKERS_AI_CHAT_MODEL?: string;
  WORKERS_AI_EMBEDDING_MODEL?: string;
  LLM_CHAT_MODEL?: string;
  LLM_EMBEDDING_MODEL?: string;
  LLM_REQUEST_TIMEOUT_MS?: string;
  LLM_STREAM_ENABLED?: string;
  EMBEDDING_DIMENSIONS?: string;
};

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

function logWorkersAiEmptyResponse(model: string, out: unknown): void {
  const o = out as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string };
    }>;
  };
  const choice = o.choices?.[0];
  console.error(
    JSON.stringify({
      tag: "desk_llm_empty_response",
      model,
      finish_reason: choice?.finish_reason ?? null,
      reasoning_chars: choice?.message?.reasoning_content?.length ?? 0,
      at: new Date().toISOString(),
    }),
  );
}

export type LlmChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
};

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

function parseToolCallsFromContent(content: string): LlmToolCall[] | undefined {
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
      tool_calls?: LlmToolCall[];
    };
    if (j.tool_calls?.length) return j.tool_calls;
    const name = j.tool ?? j.name;
    if (name) {
      return [
        {
          id: crypto.randomUUID(),
          name,
          arguments: JSON.stringify(j.arguments ?? {}),
        },
      ];
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
  },
): Promise<ChatOk | ChatErr> {
  if (!workersAiConfigured(env)) return { ok: false, reason: "not_configured" };

  const model = resolveChatModel(env);
  const aiMessages = params.messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.tool_call_id,
        name: m.name,
      };
    }
    return { role: m.role, content: m.content };
  });

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

    const data = out as {
      response?: string;
      choices?: Array<{ message?: { content?: string }; text?: string }>;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
        name?: string;
        arguments?: string;
      }>;
      usage?: UsageTags;
    };

    let toolCalls: LlmToolCall[] | undefined;
    if (data.tool_calls?.length) {
      toolCalls = data.tool_calls.map((tc, i) => ({
        id: tc.id ?? `call_${i}`,
        name: tc.function?.name ?? tc.name ?? "unknown",
        arguments: tc.function?.arguments ?? tc.arguments ?? "{}",
      }));
    } else {
      toolCalls = parseToolCallsFromContent(extractWorkersAiChatText(out));
    }

    const content = extractWorkersAiChatText(out);
    if (!content && !toolCalls?.length) {
      logWorkersAiEmptyResponse(model, out);
      return { ok: false, reason: "empty_response" };
    }
    return {
      ok: true,
      content,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      toolCalls,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    logWorkersAiError(model, e);
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
      logWorkersAiEmptyResponse(model, out);
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
  choices?: Array<{ delta?: { content?: string }; text?: string }>;
  tool_calls?: Array<{
    id?: string;
    function?: { name?: string; arguments?: string };
    name?: string;
    arguments?: string;
  }>;
};

function mapWorkersAiToolCalls(
  raw: WorkersAiStreamChunk["tool_calls"],
): LlmToolCall[] | undefined {
  if (!raw?.length) return undefined;
  return raw.map((tc, i) => ({
    id: tc.id ?? `call_${i}`,
    name: tc.function?.name ?? tc.name ?? "unknown",
    arguments: tc.function?.arguments ?? tc.arguments ?? "{}",
  }));
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
  onDelta: (chunk: string) => void,
): Promise<WorkersAiStreamResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let toolCalls: LlmToolCall[] | undefined;
  const cumulativeResponse = { value: "" };

  const emit = (raw: string) => {
    if (!raw || raw === "[DONE]") return;
    try {
      const j = JSON.parse(raw) as WorkersAiStreamChunk;
      const fromChunk = mapWorkersAiToolCalls(j.tool_calls);
      if (fromChunk?.length) toolCalls = fromChunk;
    } catch {
      // not JSON — fall through to delta extraction
    }
    const piece = extractWorkersAiStreamDelta(raw, cumulativeResponse);
    if (!piece) return;
    full += piece;
    onDelta(piece);
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
        emit(line.slice(5).trim());
      } else {
        emit(line);
      }
    }
  }

  if (buffer.trim()) {
    emit(buffer.trim());
  }

  const content = full.trim();
  const parsedTools = parseToolCallsFromContent(content);
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
    onDelta: (chunk: string) => void;
  },
): Promise<ChatOk | ChatErr> {
  if (!workersAiConfigured(env)) return { ok: false, reason: "not_configured" };

  const model = resolveChatModel(env);
  const aiMessages = params.messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.tool_call_id,
        name: m.name,
      };
    }
    return { role: m.role, content: m.content };
  });

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

    const stream = (await env.AI!.run(
      model,
      workersAiChatRequestBody(model, body),
      aiOptions(env),
    )) as unknown as ReadableStream<Uint8Array>;

    const parsed = await readWorkersAiStream(stream, params.onDelta);
    const finalText = parsed.content || "";
    if (!finalText && !parsed.toolCalls?.length) {
      logWorkersAiEmptyResponse(model, { stream_empty: true });
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
    onDelta: (chunk: string) => void;
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
      logWorkersAiEmptyResponse(model, { stream_empty: true });
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
