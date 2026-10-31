import { validateAssistantMessage } from "@chatbot/chat-ui/validate";
import type { LlmEnv } from "../llm-client";
import {
  llmChatWithMessages,
  llmChatWithMessagesStream,
  llmStreamingEnabled,
} from "../llm-client";
import { harnessLazyToolsEnabled, type HarnessEnv } from "../harness/flags";
import { logHarnessMetric } from "../harness/metrics";
import { routeToolNames } from "../harness/tool-router";
import { agentLlmTurn } from "./agent-llm-turn";
import { executeHttpTool, executeMcpTool } from "./execute";
import { loadBotAgentTools } from "./load-tools";
import {
  rankToolsForUserMessage,
  shouldUseToolFastPath,
  isSmallTalkMessage,
} from "./tool-rank";
import {
  buildCompactCatalogPrompt,
  searchToolsInCatalog,
  selectToolsByName,
  MAX_SCHEMAS_PER_TURN,
} from "./tool-catalog";
import {
  HARNESS_INTERNAL_TOOL_DEFINITIONS,
  HARNESS_SEARCH_TOOLS,
  HARNESS_SELECT_TOOLS,
} from "./harness-internal-tools";
import { parametersToJsonSchema } from "./openapi";
import type { AgentTool, LlmToolSchema } from "./types";
import { visitorMessageForLlmFailure } from "../visitor-chat-errors";
import {
  assistantTextIncludesDeskBlock,
  COMMERCE_TOOL,
  COMMERCE_VISITOR_LABEL,
  DESK_UI_BLOCK_TYPE,
} from "@chatbot/domain";
import {
  extractCatalogPricesFromToolOutput,
  isCatalogHttpTool,
} from "../commerce/catalog-price";
import type { CommerceService } from "../commerce/commerce-service";
import {
  COMMERCE_LLM_TOOLS,
  executeCommerceTool,
  isCommerceToolName,
} from "../commerce/commerce-tools";
import {
  mergeProductCatalogPickerFromToolProducts,
  type CommerceToolProduct,
} from "../commerce/native-catalog-ui";
import { executeDeskIntegrationTool } from "./execute-integration-tool";
import { type PendingPrompt } from "@chatbot/domain";
import {
  inferAgentVisitorTurnKind,
  type VisitorTurnIntent,
  type VisitorTurnKind,
} from "@chatbot/domain";

export type AgentRunResult = {
  text: string;
  creditsEstimate: number;
  pendingPrompt?: import("@chatbot/domain").PendingPrompt | null;
  turnKind?: VisitorTurnKind;
  recordStruggle?: boolean;
};

export type AgentStreamHandlers = {
  onStreamStart?: () => void;
  onDelta?: (chunk: string) => void;
};

export type AgentHarnessEnv = LlmEnv &
  HarnessEnv & {
    DB?: D1Database;
    ENCRYPTION_KEY?: string;
    ANALYTICS?: AnalyticsEngineDataset;
    TENANT_CACHE?: KVNamespace;
  };

function toLlmTools(agentTools: AgentTool[]): LlmToolSchema[] {
  return agentTools.map((at) => {
    if (at.kind === "http") {
      return {
        type: "function",
        function: {
          name: at.tool.name,
          description: at.tool.description.slice(0, 800),
          parameters: parametersToJsonSchema(at.tool.parameters),
        },
      };
    }
    if (at.kind === "integration") {
      return {
        type: "function",
        function: {
          name: at.tool.name,
          description: at.tool.description.slice(0, 800),
          parameters: at.tool.inputSchema,
        },
      };
    }
    return {
      type: "function",
      function: {
        name: at.tool.name,
        description: at.tool.description.slice(0, 800),
        parameters: (at.tool.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      },
    };
  });
}

type Msg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

function parseCommerceSearchProducts(
  output: string,
): CommerceToolProduct[] | null {
  try {
    const data = JSON.parse(output) as {
      ok?: boolean;
      products?: CommerceToolProduct[];
    };
    if (!data.ok || !data.products?.length) return null;
    return data.products;
  } catch {
    return null;
  }
}

function attachCatalogPickerIfNeeded(
  text: string,
  searchProducts: CommerceToolProduct[] | null,
  buttonLabel = COMMERCE_VISITOR_LABEL.catalogModalButton,
): string {
  if (!searchProducts?.length) return text;
  return mergeProductCatalogPickerFromToolProducts(
    text,
    searchProducts,
    buttonLabel,
  );
}

const COMMERCE_REPAIR_HINT = `Revisa el turno del visitante. Si necesita ver productos publicados, invoca ${COMMERCE_TOOL.searchProducts} con la query que infieras del historial y responde en una frase breve; el runtime adjuntará ${DESK_UI_BLOCK_TYPE.productCatalog}. Si no requiere catálogo (saludo, FAQ, postventa), responde brevemente sin invocar search.`;

async function agentLlmTurnWithRetry(
  env: AgentHarnessEnv,
  params: Parameters<typeof agentLlmTurn>[1],
): Promise<Awaited<ReturnType<typeof agentLlmTurn>>> {
  let result = await agentLlmTurn(env, params);
  if (
    !result.ok &&
    (result.reason === "http_error" || result.reason === "timeout")
  ) {
    result = await agentLlmTurn(env, params);
  }
  return result;
}

function rebuildLlmTools(
  commerceEnabled: boolean,
  agentTools: AgentTool[],
): LlmToolSchema[] {
  return [
    ...(commerceEnabled ? COMMERCE_LLM_TOOLS : []),
    ...toLlmTools(agentTools),
  ];
}

function logDeskCommerceTurn(meta: {
  searchUsed: boolean;
  repairUsed: boolean;
  fallbackUsed: boolean;
  hasProductCatalog: boolean;
}): void {
  console.error(
    JSON.stringify({
      tag: "desk_commerce_turn",
      ...meta,
      at: new Date().toISOString(),
    }),
  );
}

function lastUserContent(messages: Msg[], fallback: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && m.content.trim()) {
      return m.content.trim();
    }
  }
  return fallback.trim();
}

function pendingFromCommerceToolOutput(
  toolName: string,
  output: string,
): PendingPrompt | null {
  if (toolName !== "commerce_offer_action") return null;
  try {
    const data = JSON.parse(output) as { pending?: PendingPrompt };
    return data.pending ?? null;
  } catch {
    return null;
  }
}

function agentResultWithPending(
  base: AgentRunResult,
  pending: PendingPrompt | null,
): AgentRunResult {
  if (!pending) return base;
  return {
    ...base,
    pendingPrompt: pending,
    turnKind: "pending_offer",
  };
}

async function runCommerceCatalogSearch(
  commerceService: CommerceService,
  mode: "browse" | "search",
  query = "",
): Promise<CommerceToolProduct[] | null> {
  const output = await executeCommerceTool(
    commerceService,
    "commerce_search_products",
    mode === "browse" ? { mode: "browse" } : { mode: "search", query },
  );
  return parseCommerceSearchProducts(output);
}

async function runCommerceCatalogBrowseRescue(
  commerceService: CommerceService,
): Promise<CommerceToolProduct[] | null> {
  return runCommerceCatalogSearch(commerceService, "browse");
}

async function runCommerceCatalogFallback(
  commerceService: CommerceService,
  messages: Msg[],
  userMessage: string,
): Promise<CommerceToolProduct[] | null> {
  const visitorText = lastUserContent(messages, userMessage);
  if (isSmallTalkMessage(visitorText)) return null;
  return runCommerceCatalogBrowseRescue(commerceService);
}

async function agentTurnFailureOrRescue(args: {
  reason: "not_configured" | "http_error" | "timeout" | "empty_response";
  commerceEnabled: boolean;
  commerceService: CommerceService | undefined;
  messages: Msg[];
  userMessage: string;
  totalCredits: number;
  prose?: string;
}): Promise<AgentRunResult> {
  const visitorText = lastUserContent(args.messages, args.userMessage);
  if (args.commerceEnabled && args.commerceService) {
    console.error(
      JSON.stringify({
        tag: "desk_agent_turn_rescue",
        reason: args.reason,
        visitorText: visitorText.slice(0, 120),
        rescued: false,
        rescueMode: "honest_message",
        at: new Date().toISOString(),
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        tag: "desk_agent_turn_rescue",
        reason: args.reason,
        visitorText: visitorText.slice(0, 120),
        rescued: false,
        commerceEnabled: args.commerceEnabled,
        at: new Date().toISOString(),
      }),
    );
  }
  return {
    text: llmFailureText(args.reason, args.commerceEnabled),
    creditsEstimate: args.totalCredits,
    turnKind: "agent_struggling",
    recordStruggle: true,
  };
}

function llmFailureText(
  reason: "not_configured" | "http_error" | "timeout" | "empty_response",
  commerceEnabled: boolean,
): string {
  return visitorMessageForLlmFailure(reason, {
    commerceToolsActive: commerceEnabled,
  });
}

async function runDiscoveryPhase(
  env: AgentHarnessEnv,
  params: {
    baseSystem: string;
    user: string;
    allTools: AgentTool[];
    botId: string;
  },
): Promise<{ hydrated: AgentTool[]; credits: number }> {
  const catalogBlock = buildCompactCatalogPrompt(params.allTools);
  const system = [
    params.baseSystem,
    catalogBlock,
    "Primero elige acciones con harness_search_tools o harness_select_tools. No inventes nombres.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: params.user },
  ];

  let credits = 0;
  let hydrated: AgentTool[] = [];

  for (let i = 0; i < 2; i++) {
    const result = await agentLlmTurnWithRetry(env, {
      messages,
      tools: HARNESS_INTERNAL_TOOL_DEFINITIONS,
      allowStream: false,
    });
    if (!result.ok) break;
    credits += Math.ceil((result.promptTokens + result.completionTokens) / 4);
    logHarnessMetric(env.ANALYTICS, {
      botId: params.botId,
      phase: "discovery",
      toolCount: HARNESS_INTERNAL_TOOL_DEFINITIONS.length,
      promptTokens: result.promptTokens,
      catalogSize: params.allTools.length,
    });

    if (!result.toolCalls?.length) break;

    messages.push({ role: "assistant", content: result.content || "" });

    for (const call of result.toolCalls) {
      let output = JSON.stringify({ error: "unknown" });
      try {
        const args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        if (call.name === HARNESS_SEARCH_TOOLS) {
          const query = String(args.query ?? params.user);
          const limit = Math.min(
            MAX_SCHEMAS_PER_TURN,
            Math.max(1, Number(args.limit) || MAX_SCHEMAS_PER_TURN),
          );
          const hits = searchToolsInCatalog(params.allTools, query, limit);
          output = JSON.stringify({
            tools: hits.map((t) => ({
              name: t.tool.name,
              description: t.tool.description.slice(0, 160),
            })),
          });
        } else if (call.name === HARNESS_SELECT_TOOLS) {
          const names = Array.isArray(args.names)
            ? args.names.map(String)
            : [];
          const { selected, missing } = selectToolsByName(params.allTools, names);
          hydrated = selected;
          output = JSON.stringify({
            selected: selected.map((t) => t.tool.name),
            missing,
          });
        }
      } catch (e) {
        output = JSON.stringify({
          error: e instanceof Error ? e.message : "harness_failed",
        });
      }
      messages.push({
        role: "tool",
        content: output,
        tool_call_id: call.id,
        name: call.name,
      });
    }
    if (hydrated.length) break;
  }

  return { hydrated, credits };
}

async function resolveToolsForTurn(
  env: AgentHarnessEnv,
  allTools: AgentTool[],
  userMessage: string,
): Promise<AgentTool[]> {
  if (!harnessLazyToolsEnabled(env)) {
    return rankToolsForUserMessage(allTools, userMessage);
  }

  const fast = shouldUseToolFastPath(allTools, userMessage);
  if (fast?.length) return fast;

  const routed = await routeToolNames(env, userMessage, allTools);
  if (routed?.length) {
    const { selected } = selectToolsByName(allTools, routed);
    if (selected.length) return selected.slice(0, MAX_SCHEMAS_PER_TURN);
  }

  return [];
}

const MAX_HTTP_TOOL_CALLS_PER_TURN = 12;

export type AgentChatTurn = { role: "user" | "assistant"; content: string };

function agentTurnMessages(system: string, turns: AgentChatTurn[]): Msg[] {
  const capped = turns.slice(-20).map((t) => ({
    role: t.role,
    content: t.content.slice(0, 3500),
  }));
  return [{ role: "system", content: system }, ...capped];
}

async function runCommerceRepairPass(args: {
  env: AgentHarnessEnv;
  messages: Msg[];
  llmTools: LlmToolSchema[];
  toolIndex: Map<string, AgentTool>;
  commerceService: CommerceService;
  sanitize: (raw: string) => string;
}): Promise<{
  text: string;
  credits: number;
  search: CommerceToolProduct[] | null;
} | null> {
  const { env, messages, llmTools, toolIndex, commerceService, sanitize } =
    args;
  messages.push({ role: "system", content: COMMERCE_REPAIR_HINT });
  let credits = 0;
  let lastSearch: CommerceToolProduct[] | null = null;

  for (let step = 0; step < 2; step++) {
    const result = await agentLlmTurnWithRetry(env, {
      messages,
      tools: llmTools,
      allowStream: false,
      requireTools: true,
    });
    if (!result.ok) return null;
    credits += Math.ceil(
      (result.promptTokens + result.completionTokens) / 4,
    );
    if (!result.toolCalls?.length) {
      const t = sanitize(result.content).trim();
      if (!t) return null;
      return {
        text: attachCatalogPickerIfNeeded(t, lastSearch),
        credits,
        search: lastSearch,
      };
    }
    messages.push({ role: "assistant", content: result.content || "" });
    for (const call of result.toolCalls) {
      let output = JSON.stringify({ error: "unknown_tool" });
      try {
        const toolArgs = JSON.parse(call.arguments || "{}") as Record<
          string,
          unknown
        >;
        if (isCommerceToolName(call.name)) {
          output = await executeCommerceTool(
            commerceService,
            call.name,
            toolArgs,
          );
          if (call.name === "commerce_search_products") {
            lastSearch = parseCommerceSearchProducts(output);
          }
        } else {
          const entry = toolIndex.get(call.name);
          if (entry?.kind === "http") {
            output = await executeHttpTool(entry.tool, toolArgs);
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
  return null;
}

async function finalizeCommerceAgentText(args: {
  env: AgentHarnessEnv;
  messages: Msg[];
  llmTools: LlmToolSchema[];
  toolIndex: Map<string, AgentTool>;
  commerceService: CommerceService | undefined;
  commerceEnabled: boolean;
  sanitize: (raw: string) => string;
  prose: string;
  lastCommerceSearch: CommerceToolProduct[] | null;
  commerceSearchUsedThisTurn: boolean;
  totalCredits: number;
  userMessage: string;
}): Promise<{
  text: string;
  credits: number;
  lastCommerceSearch: CommerceToolProduct[] | null;
}> {
  let withPicker = attachCatalogPickerIfNeeded(
    args.prose,
    args.lastCommerceSearch,
  );
  let credits = args.totalCredits;
  let search = args.lastCommerceSearch;
  let searchUsed = args.commerceSearchUsedThisTurn;
  let repairUsed = false;
  let fallbackUsed = false;

  if (
    args.commerceEnabled &&
    args.commerceService &&
    !searchUsed &&
    !assistantTextIncludesDeskBlock(withPicker, DESK_UI_BLOCK_TYPE.productCatalog)
  ) {
    const repaired = await runCommerceRepairPass({
      env: args.env,
      messages: args.messages,
      llmTools: args.llmTools,
      toolIndex: args.toolIndex,
      commerceService: args.commerceService,
      sanitize: args.sanitize,
    });
    if (repaired) {
      repairUsed = true;
      withPicker = repaired.text;
      credits += repaired.credits;
      if (repaired.search?.length) {
        search = repaired.search;
        searchUsed = true;
      }
    }
  }

  if (
    args.commerceEnabled &&
    args.commerceService &&
    !searchUsed &&
    !assistantTextIncludesDeskBlock(withPicker, DESK_UI_BLOCK_TYPE.productCatalog)
  ) {
    const products = await runCommerceCatalogFallback(
      args.commerceService,
      args.messages,
      args.userMessage,
    );
    if (products?.length) {
      fallbackUsed = true;
      searchUsed = true;
      search = products;
      withPicker = attachCatalogPickerIfNeeded(withPicker, products);
    }
  }

  logDeskCommerceTurn({
    searchUsed,
    repairUsed,
    fallbackUsed,
    hasProductCatalog: assistantTextIncludesDeskBlock(
      withPicker,
      DESK_UI_BLOCK_TYPE.productCatalog,
    ),
  });

  return { text: withPicker, credits, lastCommerceSearch: search };
}

async function finishAgentTurn(args: {
  env: AgentHarnessEnv;
  messages: Msg[];
  llmTools: LlmToolSchema[];
  toolIndex: Map<string, AgentTool>;
  commerceService: CommerceService | undefined;
  commerceEnabled: boolean;
  sanitize: (raw: string) => string;
  prose: string;
  lastCommerceSearch: CommerceToolProduct[] | null;
  commerceSearchUsedThisTurn: boolean;
  commerceCartMutatedThisTurn: boolean;
  totalCredits: number;
  userMessage: string;
  visitorIntent: VisitorTurnIntent;
  pendingPrompt: boolean;
}): Promise<AgentRunResult> {
  const finalized = await finalizeCommerceAgentText(args);
  if (finalized.text.trim()) {
    const hasProductCatalog = assistantTextIncludesDeskBlock(
      finalized.text,
      DESK_UI_BLOCK_TYPE.productCatalog,
    );
    const turnKind = inferAgentVisitorTurnKind({
      visitorIntent: args.visitorIntent,
      pendingPrompt: args.pendingPrompt,
      hasProductCatalog,
      commerceSearchUsed: args.commerceSearchUsedThisTurn,
      commerceCartMutated: args.commerceCartMutatedThisTurn,
      agentRescueFailure: false,
    });
    return {
      text: finalized.text,
      creditsEstimate: finalized.credits,
      turnKind,
    };
  }
  return agentTurnFailureOrRescue({
    reason: "empty_response",
    commerceEnabled: args.commerceEnabled,
    commerceService: args.commerceService,
    messages: args.messages,
    userMessage: args.userMessage,
    totalCredits: finalized.credits,
    prose: args.prose,
  });
}

export async function runAgentWithTools(
  env: AgentHarnessEnv,
  params: {
    botId: string;
    system: string;
    user: string;
    ragContext: string;
    chatHistory?: AgentChatTurn[];
    allowedHostComponents?: string[];
    handlers?: AgentStreamHandlers;
    maxToolRounds?: number;
    commerceService?: CommerceService;
    getPendingPrompt?: () => PendingPrompt | null;
    visitorIntent?: VisitorTurnIntent;
  },
): Promise<AgentRunResult> {
  const visitorIntent = params.visitorIntent ?? "general";
  const sanitize = (raw: string) =>
    validateAssistantMessage(raw, {
      allowedHostComponents: params.allowedHostComponents,
    });
  const db = env.DB;
  if (!db) {
    const turns: AgentChatTurn[] = params.chatHistory?.length
      ? params.chatHistory
      : [{ role: "user", content: params.user }];
    const r = await llmChatWithMessages(env, {
      messages: agentTurnMessages(params.system, turns),
    });
    return {
      text: r.ok ? sanitize(r.content) : visitorMessageForLlmFailure(r.reason),
      creditsEstimate: r.ok
        ? Math.ceil((r.promptTokens + r.completionTokens) / 4)
        : 0,
    };
  }

  const loadStats = { mcpListCalls: 0 };
  const allTools = await loadBotAgentTools(
    db,
    params.botId,
    env.ENCRYPTION_KEY,
    loadStats,
  );

  const commerceEnabled = Boolean(params.commerceService);

  if (!allTools.length && !commerceEnabled) {
    return runAgentWithoutTools(env, params, sanitize);
  }

  let agentTools = allTools.length
    ? await resolveToolsForTurn(env, allTools, params.user)
    : [];
  let discoveryCredits = 0;

  if (
    harnessLazyToolsEnabled(env) &&
    !agentTools.length &&
    allTools.length > MAX_SCHEMAS_PER_TURN
  ) {
    const discovery = await runDiscoveryPhase(env, {
      baseSystem: params.system,
      user: params.user,
      allTools,
      botId: params.botId,
    });
    discoveryCredits = discovery.credits;
    agentTools = discovery.hydrated;
  }

  if (!agentTools.length) {
    agentTools = rankToolsForUserMessage(allTools, params.user);
  }

  if (!agentTools.length && !commerceEnabled) {
    return runAgentWithoutTools(env, params, sanitize);
  }

  let llmTools = [
    ...(commerceEnabled ? COMMERCE_LLM_TOOLS : []),
    ...toLlmTools(agentTools),
  ];
  const toolIndex = new Map(allTools.map((t) => [t.tool.name, t]));
  const hydratedSet = new Set(agentTools.map((t) => t.tool.name));

  const system = [
    params.system,
    params.ragContext
      ? `Contexto documental (políticas, FAQ, catálogo PDF — úsalo para responder; no digas que falta FAQ si hay texto aquí):\n${params.ragContext}`
      : "",
    llmTools.length
      ? [
          "Herramientas disponibles en esta sesión: úsalas cuando el usuario necesite datos reales (no repitas el tono humano del system prompt).",
          commerceEnabled
            ? `Comercio: interpreta la intención del visitante y usa ${COMMERCE_TOOL.searchProducts} con mode browse o search, ${COMMERCE_TOOL.cartGet}, ${COMMERCE_TOOL.cartAdd}, ${COMMERCE_TOOL.cartUpdate}, ${COMMERCE_TOOL.setBuyer} y ${COMMERCE_TOOL.startCheckout} según corresponda. Tras search, el visitante debe poder abrir el catálogo con type ${DESK_UI_BLOCK_TYPE.productCatalog} (botón + lista); no vuelques el catálogo en prosa.`
            : "",
          "Si el runtime no devuelve tool_calls nativos, responde solo con:",
          '```json\n{"tool":"nombre_exacto","arguments":{}}\n```',
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: Msg[] = agentTurnMessages(
    system,
    params.chatHistory?.length
      ? params.chatHistory
      : [{ role: "user", content: params.user }],
  );

  let totalCredits = discoveryCredits;
  const maxRounds = params.maxToolRounds ?? 8;
  let usedTools = false;
  let hydrationRetries = 0;
  let httpToolCalls = 0;
  let lastCommerceSearch: CommerceToolProduct[] | null = null;
  let commerceSearchUsedThisTurn = false;
  let commerceCartMutatedThisTurn = false;
  let pendingPromptOut: PendingPrompt | null = null;

  logHarnessMetric(env.ANALYTICS, {
    botId: params.botId,
    phase: "execute",
    toolCount: llmTools.length,
    catalogSize: allTools.length,
    mcpListCalls: loadStats.mcpListCalls,
  });

  for (let round = 0; round < maxRounds; round++) {
    if (
      usedTools &&
      params.handlers?.onDelta &&
      llmStreamingEnabled(env)
    ) {
      params.handlers.onStreamStart?.();
      const streamed = await llmChatWithMessagesStream(env, {
        messages,
        onDelta: (chunk) => params.handlers?.onDelta?.(chunk),
      });
      if (!streamed.ok || !streamed.content.trim()) {
        const fallback = await llmChatWithMessages(env, { messages });
        if (!fallback.ok) {
          return agentResultWithPending(
            await agentTurnFailureOrRescue({
            reason: fallback.reason,
            commerceEnabled,
            commerceService: params.commerceService,
            messages,
            userMessage: params.user,
            totalCredits,
          }),
            pendingPromptOut,
          );
        }
        totalCredits += Math.ceil(
          (fallback.promptTokens + fallback.completionTokens) / 4,
        );
        const text = sanitize(fallback.content).trim();
        if (!text) {
          return agentResultWithPending(
            await agentTurnFailureOrRescue({
              reason: "empty_response",
              commerceEnabled,
              commerceService: params.commerceService,
              messages,
              userMessage: params.user,
              totalCredits,
            }),
            pendingPromptOut,
          );
        }
        return agentResultWithPending(
          await finishAgentTurn({
          env,
          messages,
          llmTools,
          toolIndex,
          commerceService: params.commerceService,
          commerceEnabled,
          sanitize,
          prose: text,
          lastCommerceSearch,
          commerceSearchUsedThisTurn,
          commerceCartMutatedThisTurn,
          totalCredits,
          userMessage: params.user,
          visitorIntent,
          pendingPrompt: Boolean(pendingPromptOut),
        }),
          pendingPromptOut,
        );
      }
      totalCredits += Math.ceil(streamed.completionTokens / 4);
      return agentResultWithPending(
        await finishAgentTurn({
        env,
        messages,
        llmTools,
        toolIndex,
        commerceService: params.commerceService,
        commerceEnabled,
        sanitize,
        prose: sanitize(streamed.content),
        lastCommerceSearch,
        commerceSearchUsedThisTurn,
        commerceCartMutatedThisTurn,
        totalCredits,
        userMessage: params.user,
        visitorIntent,
        pendingPrompt: Boolean(pendingPromptOut),
      }),
        pendingPromptOut,
      );
    }

    const result = await agentLlmTurnWithRetry(env, {
      messages,
      tools: llmTools,
      allowStream: !usedTools,
      requireTools: commerceEnabled,
      onStreamStart: params.handlers?.onStreamStart,
      onDelta: params.handlers?.onDelta,
    });

    if (!result.ok) {
      return agentResultWithPending(
        await agentTurnFailureOrRescue({
          reason: result.reason,
          commerceEnabled,
          commerceService: params.commerceService,
          messages,
          userMessage: params.user,
          totalCredits,
        }),
        pendingPromptOut,
      );
    }
    totalCredits += Math.ceil(
      (result.promptTokens + result.completionTokens) / 4,
    );

    if (!result.toolCalls?.length) {
      const finalText = sanitize(result.content).trim();
      if (finalText) {
        return agentResultWithPending(
          await finishAgentTurn({
          env,
          messages,
          llmTools,
          toolIndex,
          commerceService: params.commerceService,
          commerceEnabled,
          sanitize,
          prose: finalText,
          lastCommerceSearch,
          commerceSearchUsedThisTurn,
          commerceCartMutatedThisTurn,
          totalCredits,
          userMessage: params.user,
          visitorIntent,
          pendingPrompt: Boolean(pendingPromptOut),
        }),
          pendingPromptOut,
        );
      }
      break;
    }

    usedTools = true;

    messages.push({
      role: "assistant",
      content: result.content || "",
    });

    for (const call of result.toolCalls) {
      const entry = toolIndex.get(call.name);
      if (entry && !hydratedSet.has(call.name) && hydrationRetries < 1) {
        hydrationRetries += 1;
        agentTools = [entry];
        hydratedSet.add(call.name);
        llmTools = rebuildLlmTools(commerceEnabled, agentTools);
      }

      let output = JSON.stringify({ error: "unknown_tool" });
      try {
        const args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        if (
          isCommerceToolName(call.name) &&
          params.commerceService
        ) {
          output = await executeCommerceTool(
            params.commerceService,
            call.name,
            args,
          );
          if (call.name === "commerce_search_products") {
            commerceSearchUsedThisTurn = true;
            lastCommerceSearch = parseCommerceSearchProducts(output);
          }
          if (
            call.name === "commerce_cart_add" ||
            call.name === "commerce_cart_update" ||
            call.name === "commerce_cart_remove"
          ) {
            commerceCartMutatedThisTurn = true;
          }
          const offered = pendingFromCommerceToolOutput(call.name, output);
          if (offered) pendingPromptOut = offered;
        } else if (entry?.kind === "http") {
          if (httpToolCalls >= MAX_HTTP_TOOL_CALLS_PER_TURN) {
            output = JSON.stringify({ error: "http_tool_limit" });
          } else {
            httpToolCalls += 1;
            output = await executeHttpTool(entry.tool, args);
            if (
              params.commerceService &&
              isCatalogHttpTool(entry.tool.name, entry.tool.description)
            ) {
              const prices = extractCatalogPricesFromToolOutput(output);
              params.commerceService.recordCatalogPrices(prices);
            }
          }
        } else if (entry?.kind === "mcp") {
          output = await executeMcpTool(
            entry.tool.serverUrl,
            entry.tool.headers,
            call.name,
            args,
          );
        } else if (entry?.kind === "integration") {
          output = await executeDeskIntegrationTool(entry.tool, args);
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

  if (usedTools && params.handlers?.onDelta && llmStreamingEnabled(env)) {
    params.handlers.onStreamStart?.();
    const streamed = await llmChatWithMessagesStream(env, {
      messages,
      onDelta: (chunk) => params.handlers?.onDelta?.(chunk),
    });
    if (streamed.ok && streamed.content.trim()) {
      totalCredits += Math.ceil(streamed.completionTokens / 4);
      return agentResultWithPending(
        await finishAgentTurn({
        env,
        messages,
        llmTools,
        toolIndex,
        commerceService: params.commerceService,
        commerceEnabled,
        sanitize,
        prose: sanitize(streamed.content),
        lastCommerceSearch,
        commerceSearchUsedThisTurn,
        commerceCartMutatedThisTurn,
        totalCredits,
        userMessage: params.user,
        visitorIntent,
        pendingPrompt: Boolean(pendingPromptOut),
      }),
        pendingPromptOut,
      );
    }
  }

  const final = await llmChatWithMessages(env, { messages });
  if (!final.ok) {
    return agentResultWithPending(
      await agentTurnFailureOrRescue({
        reason: final.reason,
        commerceEnabled,
        commerceService: params.commerceService,
        messages,
        userMessage: params.user,
        totalCredits,
      }),
      pendingPromptOut,
    );
  }
  totalCredits += Math.ceil(
    (final.promptTokens + final.completionTokens) / 4,
  );
  const text = sanitize(final.content).trim();
  return agentResultWithPending(
    await finishAgentTurn({
    env,
    messages,
    llmTools,
    toolIndex,
    commerceService: params.commerceService,
    commerceEnabled,
    sanitize,
    prose: text,
    lastCommerceSearch,
    commerceSearchUsedThisTurn,
    commerceCartMutatedThisTurn,
    totalCredits,
    userMessage: params.user,
    visitorIntent,
    pendingPrompt: Boolean(pendingPromptOut),
  }),
    pendingPromptOut,
  );
}

async function runAgentWithoutTools(
  env: AgentHarnessEnv,
  params: {
    system: string;
    user: string;
    ragContext: string;
    chatHistory?: AgentChatTurn[];
    handlers?: AgentStreamHandlers;
    allowedHostComponents?: string[];
  },
  sanitize: (raw: string) => string,
): Promise<AgentRunResult> {
  const systemWithRag = [
    params.system,
    params.ragContext ? `Contexto documental:\n${params.ragContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const turns: AgentChatTurn[] = params.chatHistory?.length
    ? params.chatHistory
    : [{ role: "user", content: params.user }];
  const llmMessages = agentTurnMessages(systemWithRag, turns);

  const useStream = llmStreamingEnabled(env) && Boolean(params.handlers?.onDelta);
  if (useStream) {
    params.handlers?.onStreamStart?.();
    const streamed = await llmChatWithMessagesStream(env, {
      messages: llmMessages,
      onDelta: (chunk) => params.handlers?.onDelta?.(chunk),
    });
    if (streamed.ok && streamed.content.trim()) {
      return {
        text: sanitize(streamed.content),
        creditsEstimate: Math.ceil(streamed.completionTokens / 4),
      };
    }
  }

  const r = await llmChatWithMessages(env, {
    messages: llmMessages,
  });
  return {
    text: r.ok ? sanitize(r.content) : visitorMessageForLlmFailure(r.reason),
    creditsEstimate: r.ok
      ? Math.ceil((r.promptTokens + r.completionTokens) / 4)
      : 0,
  };
}
