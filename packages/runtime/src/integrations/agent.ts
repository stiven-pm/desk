import { validateAssistantMessage } from "@chatbot/chat-ui/validate";
import type { LlmEnv } from "../llm-client";
import {
  llmChatWithMessages,
  llmChatWithMessagesStream,
  llmStreamingEnabled,
} from "../llm-client";
import { agentFlowToolsEnabled, integrationCodeModeEnabled, type HarnessEnv } from "../harness/flags";
import { logHarnessMetric } from "../harness/metrics";
import {
  deskTrace,
  deskTraceClip,
  deskTraceJson,
  deskTraceRuntimeFlags,
  deskTraceToolNames,
  type DeskTraceScope,
} from "../desk-trace";
import { agentLlmTurn } from "./agent-llm-turn";
import {
  deskEscalateHumanLlmTool,
  isDeskEscalateHumanTool,
  parseDeskEscalateHumanArgs,
} from "./desk-escalate-human-tool";
import {
  deskVisitorMessageLlmTool,
  isDeskVisitorMessageTool,
  parseDeskVisitorMessageArgs,
} from "./desk-visitor-message-tool";
import { extractVisitorFacingText } from "./llm-visitor-output";
import { executeHttpTool, executeMcpTool } from "./execute";
import { loadBotAgentTools } from "./load-tools";
import type { AgentTool, LlmToolSchema } from "./types";
import { visitorMessageForLlmFailure, VISITOR_CHAT_DEGRADED_NO_TOOLS } from "../visitor-chat-errors";
import {
  assistantTextIncludesDeskBlock,
  COMMERCE_TOOL,
  COMMERCE_VISITOR_LABEL,
  CHAT_DEFAULT_MAX_TOKENS,
  DESK_AGENT_TOOL,
  DESK_UI_BLOCK_TYPE,
  type CheckoutPhase,
} from "@chatbot/domain";
import {
  extractCatalogPricesFromToolOutput,
  isCatalogHttpTool,
} from "../commerce/catalog-price";
import type { CommerceService } from "../commerce/commerce-service";
import { agentChatTurnsForLlm } from "../visitor-chat-history";
import {
  commerceLlmToolsForAgent,
  executeCommerceTool,
  isCommerceToolName,
} from "../commerce/commerce-tools";
import { isCommerceFlowToolName } from "../commerce/commerce-flow-tools";
import { appendCheckoutPaymentDeskUi } from "../commerce/commerce-ui";
import { NATIVE_COMMERCE_LEAD } from "@chatbot/domain";
import {
  mergeProductCatalogPickerFromToolProducts,
  type CommerceToolProduct,
} from "../commerce/native-catalog-ui";
import { executeDeskIntegrationTool } from "./execute-integration-tool";
import {
  DESK_CALL_INTEGRATION,
  DESK_SEARCH_INTEGRATIONS,
  deskIntegrationMetaToolSchemas,
  isDeskIntegrationMetaTool,
  runDeskCallIntegration,
  runDeskSearchIntegrations,
  shouldOfferDeskIntegrationMetaTools,
} from "./integration-meta-tools";
import {
  buildIntegrationApiReference,
  deskCodemodeToolSchema,
  isDeskCodemodeTool,
  runDeskCodemode,
  agentToolToLlmSchema,
} from "./integration-code-mode";
import { type PendingPrompt } from "@chatbot/domain";
import {
  inferAgentVisitorTurnKind,
  type VisitorTurnIntent,
  type VisitorTurnKind,
} from "@chatbot/domain";
import type { VisitorAgentStreamHandlers } from "../visitor-agent-stream";

export type AgentRunResult = {
  text: string;
  creditsEstimate: number;
  pendingPrompt?: import("@chatbot/domain").PendingPrompt | null;
  turnKind?: VisitorTurnKind;
  recordStruggle?: boolean;
  escalateToHuman?: boolean;
};

export type AgentStreamHandlers = VisitorAgentStreamHandlers;

export type AgentHarnessEnv = LlmEnv &
  HarnessEnv & {
    DB?: D1Database;
    ENCRYPTION_KEY?: string;
    ANALYTICS?: AnalyticsEngineDataset;
    TENANT_CACHE?: KVNamespace;
    LOADER?: import("./desk-codemode-sandbox").WorkerLoaderBinding;
    DESK_CODEMODE?: {
      get(options: { props: { botId: string } }): import("./desk-codemode-sandbox").DeskCodemodeRpc;
    };
  };

function toLlmTools(agentTools: AgentTool[]): LlmToolSchema[] {
  return agentTools.map((at) => agentToolToLlmSchema(at));
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return deskTraceClip(raw, 400);
  }
}

type Msg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

const POST_TOOLS_PROSE_SUFFIX = `

## Reply now
Tool results are already in this thread. Call \`${DESK_AGENT_TOOL.visitorMessage}\` with \`{ text }\` for the visitor-facing reply. Do not use XML, JSON-in-prose, or free-text tool syntax. Do not call more data tools unless critical facts are still missing.`;

function appendSystemSuffix(messages: Msg[], suffix: string): Msg[] {
  const out = [...messages];
  if (out[0]?.role === "system") {
    out[0] = { role: "system", content: `${out[0].content}${suffix}` };
  }
  return out;
}

async function synthesizeAgentProseAfterTools(
  env: AgentHarnessEnv,
  messages: Msg[],
  logContext: { botId?: string; conversationId?: string },
  unwrapVisitorText: (raw: string) => string,
): Promise<
  | { ok: true; content: string; promptTokens: number; completionTokens: number }
  | { ok: false; reason: "not_configured" | "http_error" | "timeout" | "empty_response" }
> {
  const maxTokens = CHAT_DEFAULT_MAX_TOKENS * 2;
  const visitorTool = deskVisitorMessageLlmTool();
  const r = await agentLlmTurn(env, {
    messages: appendSystemSuffix(messages, POST_TOOLS_PROSE_SUFFIX),
    tools: [visitorTool],
    allowStream: false,
    logContext: { ...logContext, ladderStep: 90 },
  });
  if (!r.ok) {
    return { ok: false, reason: r.reason };
  }
  const fromTool = r.toolCalls?.find((tc) =>
    isDeskVisitorMessageTool(tc.name),
  );
  if (fromTool) {
    try {
      const args = JSON.parse(fromTool.arguments || "{}") as Record<
        string,
        unknown
      >;
      const text = unwrapVisitorText(parseDeskVisitorMessageArgs(args));
      if (text.trim()) {
        return {
          ok: true,
          content: text,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
        };
      }
    } catch {
      /* fall through */
    }
  }
  const text = unwrapVisitorText(r.content);
  if (text.trim()) {
    return {
      ok: true,
      content: text,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
    };
  }
  return { ok: false, reason: "empty_response" };
}

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

function llmToolNames(llmTools: LlmToolSchema[]): string[] {
  return llmTools.map((t) => t.function.name);
}

function unknownToolOutput(callName: string, llmTools: LlmToolSchema[]): string {
  return JSON.stringify({
    ok: false,
    error: "unknown_tool",
    name: callName,
    hint: "Usa solo herramientas disponibles en este turno.",
    allowedSample: llmToolNames(llmTools).slice(0, 12),
  });
}

function toolResultErrorKey(output: string): string | null {
  try {
    const j = JSON.parse(output) as { ok?: boolean; error?: string };
    if (j.ok === false && j.error) return j.error;
    if (typeof j.error === "string" && j.error) return j.error;
  } catch {
    return null;
  }
  return null;
}

const TOOL_ERROR_STREAK_HINT =
  "Varias herramientas fallaron igual. Responde al visitante en una frase; no repitas la misma llamada.";

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
  agentFlowTools: boolean,
): LlmToolSchema[] {
  return [
    ...(commerceEnabled
      ? commerceLlmToolsForAgent({ agentFlowTools })
      : []),
    ...toLlmTools(agentTools),
  ];
}

function applyFlowToolSideEffects(
  toolName: string,
  output: string,
  state: {
    commerceCartView: boolean;
    commerceCheckoutStep: boolean;
    flowAssistantAppend: string;
  },
): void {
  if (!isCommerceFlowToolName(toolName)) return;
  try {
    const data = JSON.parse(output) as {
      step?: string;
      assistantHint?: string;
      checkoutUrl?: string;
      showCartUi?: boolean;
    };
    if (toolName === "commerce_view_cart" || data.showCartUi) {
      state.commerceCartView = true;
      if (data.assistantHint?.trim()) {
        state.flowAssistantAppend = data.assistantHint;
      }
    }
    if (
      toolName === "commerce_begin_payment" ||
      toolName === "commerce_provide_buyer_fields" ||
      toolName === "commerce_set_fulfillment"
    ) {
      if (data.step === "blocked" || data.step === "link_ready") {
        state.commerceCheckoutStep = true;
      }
      if (data.step === "link_ready" && data.checkoutUrl) {
        state.flowAssistantAppend = appendCheckoutPaymentDeskUi(
          NATIVE_COMMERCE_LEAD.checkoutLink,
          data.checkoutUrl,
        );
      }
    }
  } catch {
    /* ignore */
  }
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

function resolveToolsForTurn(allTools: AgentTool[]): AgentTool[] {
  return allTools;
}

const MAX_HTTP_TOOL_CALLS_PER_TURN = 12;

export type AgentChatTurn = { role: "user" | "assistant"; content: string };

function agentTurnMessages(system: string, turns: AgentChatTurn[]): Msg[] {
  return [
    { role: "system", content: system },
    ...agentChatTurnsForLlm(turns, 24).map((t) => ({
      role: t.role,
      content: t.content,
    })),
  ];
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
  checkoutFlowPhase: CheckoutPhase;
}): Promise<{
  text: string;
  credits: number;
  lastCommerceSearch: CommerceToolProduct[] | null;
}> {
  const checkoutIdle = args.checkoutFlowPhase === "idle";
  let withPicker = checkoutIdle
    ? attachCatalogPickerIfNeeded(args.prose, args.lastCommerceSearch)
    : args.prose;
  let credits = args.totalCredits;
  const search = args.lastCommerceSearch;
  const searchUsed = args.commerceSearchUsedThisTurn;

  logDeskCommerceTurn({
    searchUsed,
    repairUsed: false,
    fallbackUsed: false,
    hasProductCatalog: assistantTextIncludesDeskBlock(
      withPicker,
      DESK_UI_BLOCK_TYPE.productCatalog,
    ),
  });

  return { text: withPicker, credits, lastCommerceSearch: search };
}

function isIntegrationToolName(name: string): boolean {
  if (isCommerceToolName(name)) return false;
  return true;
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
  checkoutFlowPhase: CheckoutPhase;
  commerceCartView?: boolean;
  commerceCheckoutStep?: boolean;
  flowAssistantAppend?: string;
  agentDegraded?: boolean;
  integrationToolsUsed?: boolean;
  allAgentTools?: AgentTool[];
  streamHandlers?: AgentStreamHandlers;
  proseAlreadyStreamed?: boolean;
  escalateToHuman?: boolean;
}): Promise<AgentRunResult> {
  const finalized = await finalizeCommerceAgentText(args);
  if (finalized.text.trim() || args.flowAssistantAppend?.trim()) {
    const hasProductCatalog = assistantTextIncludesDeskBlock(
      finalized.text,
      DESK_UI_BLOCK_TYPE.productCatalog,
    );
    let text = finalized.text.trim();
    const agentDegraded = args.agentDegraded ?? false;
    if (agentDegraded && !text.trim()) {
      text = VISITOR_CHAT_DEGRADED_NO_TOOLS;
    }
    const append = args.flowAssistantAppend?.trim();
    if (append) {
      if (!text) text = append;
      else if (
        args.commerceCartView &&
        !text.includes('"type":"cart"') &&
        append.includes('"type":"cart"')
      ) {
        text = `${text}\n${append}`;
      } else if (
        args.commerceCheckoutStep &&
        append.includes("checkout") &&
        !text.includes("desk-ui")
      ) {
        text = `${text}\n${append}`;
      }
    }
    let turnKind = inferAgentVisitorTurnKind({
      visitorIntent: args.visitorIntent,
      pendingPrompt: args.pendingPrompt,
      hasProductCatalog,
      commerceSearchUsed: args.commerceSearchUsedThisTurn,
      commerceCartMutated: args.commerceCartMutatedThisTurn,
      commerceCartView: args.commerceCartView,
      commerceCheckoutStep: args.commerceCheckoutStep,
      agentRescueFailure: agentDegraded,
      integrationToolsUsed: args.integrationToolsUsed,
    });
    if (args.escalateToHuman) {
      turnKind = "faq";
    }
    return {
      text,
      creditsEstimate: finalized.credits,
      turnKind,
      recordStruggle: agentDegraded,
      escalateToHuman: args.escalateToHuman,
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
    checkoutFlowPhase: CheckoutPhase;
    agentFlowTools?: boolean;
    conversationId?: string;
  },
): Promise<AgentRunResult> {
  const visitorIntent = params.visitorIntent ?? "general";
  const checkoutFlowPhase = params.checkoutFlowPhase ?? "idle";
  const agentFlowTools =
    params.agentFlowTools ?? agentFlowToolsEnabled(env);
  const flowFx = {
    commerceCartView: false,
    commerceCheckoutStep: false,
    flowAssistantAppend: "",
    escalateToHuman: false,
  };
  const visitorToolAllow = new Set<string>([DESK_AGENT_TOOL.visitorMessage]);
  const unwrapVisitorText = (raw: string) =>
    extractVisitorFacingText(raw, visitorToolAllow);
  const sanitize = (raw: string) =>
    validateAssistantMessage(unwrapVisitorText(raw), {
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

  const useIntegrationCodeMode =
    integrationCodeModeEnabled(env) && allTools.length > 0;

  let agentTools: AgentTool[] = [];
  let integrationMetaTools = false;
  if (allTools.length && !useIntegrationCodeMode) {
    agentTools = resolveToolsForTurn(allTools);
    integrationMetaTools = shouldOfferDeskIntegrationMetaTools(
      allTools,
      agentTools.length,
    );
  }

  if (
    !commerceEnabled &&
    !useIntegrationCodeMode &&
    !agentTools.length &&
    !integrationMetaTools
  ) {
    return runAgentWithoutTools(env, params, sanitize);
  }

  const integrationApiRef = useIntegrationCodeMode
    ? buildIntegrationApiReference(allTools)
    : "";

  const llmToolsBase = [
    ...rebuildLlmTools(commerceEnabled, agentTools, agentFlowTools),
    ...(useIntegrationCodeMode
      ? [deskCodemodeToolSchema()]
      : integrationMetaTools
        ? deskIntegrationMetaToolSchemas()
        : []),
  ];
  const llmTools =
    llmToolsBase.length > 0
      ? [
          deskVisitorMessageLlmTool(),
          deskEscalateHumanLlmTool(),
          ...llmToolsBase,
        ]
      : llmToolsBase;
  const toolIndex = new Map(allTools.map((t) => [t.tool.name, t]));

  const traceScope: DeskTraceScope = {
    botId: params.botId,
    conversationId: params.conversationId,
  };
  deskTrace(env, "agent.turn_start", {
    user: deskTraceClip(params.user, 400),
    commerceEnabled,
    catalogSize: allTools.length,
    useIntegrationCodeMode,
    integrationMetaTools,
    rankedIntegrationTools: agentTools.map((t) => t.tool.name),
    llmToolNames: deskTraceToolNames(llmTools),
    chatHistoryTurns: params.chatHistory?.length ?? 0,
    flags: deskTraceRuntimeFlags(env),
    integrationApiChars: integrationApiRef.length,
  }, traceScope);

  const system = [
    params.system,
    params.ragContext
      ? `Document context (policies, FAQ, PDF catalog — use it to answer; do not claim missing FAQ if text is here):\n${params.ragContext}`
      : "",
    integrationApiRef
      ? `Integration API (call via desk_codemode only):\n${integrationApiRef}`
      : "",
    llmTools.length
      ? [
          "Tools in this session: use them when the visitor needs real data (do not repeat generic tone from the system prompt).",
          `Turn contract: visitor-facing text via ${DESK_AGENT_TOOL.visitorMessage}({ text }). Missing-order reports: empathy + ask RK/name/document + commerce_get_order; do not call ${DESK_AGENT_TOOL.escalateHuman} on the first report. Hand off with ${DESK_AGENT_TOOL.escalateHuman}({ text }) only after triage when refund/resend/manual fix is needed. Never ask the visitor to press Talk to a person.`,
          commerceEnabled
            ? agentFlowTools
              ? `Native store: ${COMMERCE_TOOL.searchProducts} (browse/search), ${COMMERCE_TOOL.cartGet}, ${COMMERCE_TOOL.cartAdd}, ${COMMERCE_TOOL.cartUpdate}, ${COMMERCE_TOOL.getProductDetails}, ${COMMERCE_TOOL.getOrder}; checkout ${COMMERCE_TOOL.viewCart}, ${COMMERCE_TOOL.provideBuyerFields}, ${COMMERCE_TOOL.setFulfillment}, ${COMMERCE_TOOL.beginPayment}. Payment gateways and ERP orders outside native Desk: desk_codemode. After search, attach catalog UI type ${DESK_UI_BLOCK_TYPE.productCatalog}; do not dump catalog in prose.`
              : `Native store: ${COMMERCE_TOOL.searchProducts} (browse/search), ${COMMERCE_TOOL.cartGet}, ${COMMERCE_TOOL.cartAdd}, ${COMMERCE_TOOL.cartUpdate}, ${COMMERCE_TOOL.setBuyer}, ${COMMERCE_TOOL.startCheckout}, ${COMMERCE_TOOL.getOrder}. After search, catalog UI type ${DESK_UI_BLOCK_TYPE.productCatalog}.`
            : "",
          useIntegrationCodeMode
            ? "Templates and payment connectors: one desk_codemode script per turn when possible; compose desk.search and desk.call."
            : integrationMetaTools
              ? "Large integration catalog: use desk_search_integrations then desk_call_integration."
              : agentTools.length
                ? "Support lookups (order, payment, customer): prefer listed integration tools; commerce_get_order is for native Desk orders only."
                : "",
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

  const llmLogContext = {
    botId: params.botId,
    conversationId: params.conversationId,
  };

  let totalCredits = 0;
  const maxRounds = params.maxToolRounds ?? 8;
  let usedTools = false;
  let httpToolCalls = 0;
  let lastCommerceSearch: CommerceToolProduct[] | null = null;
  let commerceSearchUsedThisTurn = false;
  let commerceCartMutatedThisTurn = false;
  let integrationToolsUsedThisTurn = false;
  let pendingPromptOut: PendingPrompt | null = null;
  let toolErrorStreak = 0;
  let lastToolErrorKey: string | null = null;
  let toolErrorRecoveryUsed = false;
  let visitorMessageFromTool: string | null = null;

  logHarnessMetric(env.ANALYTICS, {
    botId: params.botId,
    phase: "execute",
    toolCount: llmTools.length,
    catalogSize: allTools.length,
    mcpListCalls: loadStats.mcpListCalls,
  });

  if (params.handlers?.onStreamStart && llmTools.length) {
    params.handlers.onStreamStart();
  }
  params.handlers?.onStatus?.("thinking");

  for (let round = 0; round < maxRounds; round++) {
    if (
      usedTools &&
      !llmTools.length &&
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
          commerceCartView: flowFx.commerceCartView,
          commerceCheckoutStep: flowFx.commerceCheckoutStep,
          flowAssistantAppend: flowFx.flowAssistantAppend,
          checkoutFlowPhase,
          integrationToolsUsed: integrationToolsUsedThisTurn,
          streamHandlers: params.handlers,
          proseAlreadyStreamed: false,
          escalateToHuman: flowFx.escalateToHuman,
          allAgentTools: allTools,
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
        commerceCartView: flowFx.commerceCartView,
        commerceCheckoutStep: flowFx.commerceCheckoutStep,
        flowAssistantAppend: flowFx.flowAssistantAppend,
        checkoutFlowPhase,
        integrationToolsUsed: integrationToolsUsedThisTurn,
        streamHandlers: params.handlers,
        proseAlreadyStreamed: true,
        escalateToHuman: flowFx.escalateToHuman,
        allAgentTools: allTools,
      }),
        pendingPromptOut,
      );
    }

    const result = await agentLlmTurnWithRetry(env, {
      messages,
      tools: llmTools,
      allowStream: !usedTools,
      logContext: llmLogContext,
      onStreamStart: params.handlers?.onStreamStart,
      onDelta: params.handlers?.onDelta,
    });

    deskTrace(env, "agent.llm_round", {
      round,
      ok: result.ok,
      reason: result.ok ? null : result.reason,
      degraded: result.ok ? result.degraded ?? false : null,
      toolCalls: result.ok
        ? (result.toolCalls ?? []).map((t) => ({
            name: t.name,
            args: deskTraceClip(t.arguments, 300),
          }))
        : [],
      assistantChars: result.ok ? result.content.length : 0,
      assistantPreview: result.ok ? deskTraceClip(result.content, 240) : "",
    }, traceScope);

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
      if (finalText && (!llmTools.length || result.degraded)) {
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
          commerceCartView: flowFx.commerceCartView,
          commerceCheckoutStep: flowFx.commerceCheckoutStep,
          flowAssistantAppend: flowFx.flowAssistantAppend,
          checkoutFlowPhase,
          agentDegraded: result.degraded,
          integrationToolsUsed: integrationToolsUsedThisTurn,
          streamHandlers: params.handlers,
          proseAlreadyStreamed: Boolean(
            params.handlers?.onDelta &&
              !usedTools &&
              llmStreamingEnabled(env) &&
              result.content.trim(),
          ),
          escalateToHuman: flowFx.escalateToHuman,
          allAgentTools: allTools,
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
      ...(result.toolCalls?.length
        ? {
            tool_calls: result.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          }
        : {}),
    });

    for (const call of result.toolCalls) {
      const entry = toolIndex.get(call.name);
      let output: string;

      params.handlers?.onStatus?.("tool", { toolName: call.name });

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      } catch (e) {
        output = JSON.stringify({
          ok: false,
          error: "invalid_arguments",
          hint: e instanceof Error ? e.message : "JSON inválido",
        });
        messages.push({
          role: "tool",
          content: output,
          tool_call_id: call.id,
          name: call.name,
        });
        const errKey = `${call.name}:invalid_arguments`;
        if (errKey === lastToolErrorKey) toolErrorStreak += 1;
        else {
          lastToolErrorKey = errKey;
          toolErrorStreak = 1;
        }
        continue;
      }

      if (isDeskCodemodeTool(call.name)) {
        try {
          if (httpToolCalls >= MAX_HTTP_TOOL_CALLS_PER_TURN) {
            output = JSON.stringify({
              ok: false,
              error: "http_tool_limit",
              hint: "Integration call limit for this turn.",
            });
          } else {
            httpToolCalls += 1;
            integrationToolsUsedThisTurn = true;
            output = await runDeskCodemode({
              code: String(args.code ?? ""),
              allTools,
              toolIndex,
              botId: params.botId,
              loader: env.LOADER,
              deskCodemode: env.DESK_CODEMODE,
              compatibilityDate: "2026-04-01",
              traceEnv: env,
              traceScope,
            });
          }
        } catch (e) {
          output = JSON.stringify({
            ok: false,
            error: "tool_failed",
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (isDeskIntegrationMetaTool(call.name)) {
        try {
          if (call.name === DESK_SEARCH_INTEGRATIONS) {
            output = runDeskSearchIntegrations(allTools, args);
          } else if (call.name === DESK_CALL_INTEGRATION) {
            if (httpToolCalls >= MAX_HTTP_TOOL_CALLS_PER_TURN) {
              output = JSON.stringify({
                ok: false,
                error: "http_tool_limit",
                hint: "Límite de consultas en este turno.",
              });
            } else {
              httpToolCalls += 1;
              output = await runDeskCallIntegration(toolIndex, args);
            }
          } else {
            output = unknownToolOutput(call.name, llmTools);
          }
        } catch (e) {
          output = JSON.stringify({
            ok: false,
            error: "tool_failed",
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (isDeskEscalateHumanTool(call.name)) {
        visitorMessageFromTool = sanitize(parseDeskEscalateHumanArgs(args));
        flowFx.escalateToHuman = true;
        output = JSON.stringify({ ok: true, escalated: true });
      } else if (isDeskVisitorMessageTool(call.name)) {
        visitorMessageFromTool = sanitize(parseDeskVisitorMessageArgs(args));
        output = JSON.stringify({ ok: true });
      } else if (
        !isCommerceToolName(call.name) &&
        !entry
      ) {
        output = unknownToolOutput(call.name, llmTools);
      } else {
        try {
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
            applyFlowToolSideEffects(call.name, output, flowFx);
            const offered = pendingFromCommerceToolOutput(call.name, output);
            if (offered) pendingPromptOut = offered;
          } else if (entry?.kind === "http") {
            if (httpToolCalls >= MAX_HTTP_TOOL_CALLS_PER_TURN) {
              output = JSON.stringify({
                ok: false,
                error: "http_tool_limit",
                hint: "Límite de consultas HTTP en este turno.",
              });
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
          } else {
            output = unknownToolOutput(call.name, llmTools);
          }
        } catch (e) {
          output = JSON.stringify({
            ok: false,
            error: "tool_failed",
            hint:
              "No se pudo completar. Explícaselo al cliente en una frase y ofrece reintentar.",
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      }

      messages.push({
        role: "tool",
        content: output,
        tool_call_id: call.id,
        name: call.name,
      });

      deskTrace(env, "agent.tool_result", {
        round,
        tool: call.name,
        args: deskTraceJson(args),
        output: deskTraceJson(safeJsonParse(output)),
        httpToolCalls,
      }, traceScope);

      const errCode = toolResultErrorKey(output);
      if (errCode) {
        const errKey = `${call.name}:${errCode}`;
        if (errKey === lastToolErrorKey) toolErrorStreak += 1;
        else {
          lastToolErrorKey = errKey;
          toolErrorStreak = 1;
        }
      } else {
        toolErrorStreak = 0;
        lastToolErrorKey = null;
        if (
          isIntegrationToolName(call.name) ||
          isDeskIntegrationMetaTool(call.name)
        ) {
          integrationToolsUsedThisTurn = true;
        }
      }
    }

    if (visitorMessageFromTool?.trim()) {
      return agentResultWithPending(
        await finishAgentTurn({
          env,
          messages,
          llmTools,
          toolIndex,
          commerceService: params.commerceService,
          commerceEnabled,
          sanitize,
          prose: visitorMessageFromTool,
          lastCommerceSearch,
          commerceSearchUsedThisTurn,
          commerceCartMutatedThisTurn,
          totalCredits,
          userMessage: params.user,
          visitorIntent,
          pendingPrompt: Boolean(pendingPromptOut),
          commerceCartView: flowFx.commerceCartView,
          commerceCheckoutStep: flowFx.commerceCheckoutStep,
          flowAssistantAppend: flowFx.flowAssistantAppend,
          checkoutFlowPhase,
          integrationToolsUsed: integrationToolsUsedThisTurn,
          streamHandlers: params.handlers,
          escalateToHuman: flowFx.escalateToHuman,
          allAgentTools: allTools,
        }),
        pendingPromptOut,
      );
    }

    if (
      toolErrorStreak >= 3 &&
      !toolErrorRecoveryUsed
    ) {
      toolErrorRecoveryUsed = true;
      messages.push({ role: "system", content: TOOL_ERROR_STREAK_HINT });
      toolErrorStreak = 0;
      lastToolErrorKey = null;
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
        commerceCartView: flowFx.commerceCartView,
        commerceCheckoutStep: flowFx.commerceCheckoutStep,
        flowAssistantAppend: flowFx.flowAssistantAppend,
        checkoutFlowPhase,
        integrationToolsUsed: integrationToolsUsedThisTurn,
        streamHandlers: params.handlers,
        proseAlreadyStreamed: true,
        escalateToHuman: flowFx.escalateToHuman,
        allAgentTools: allTools,
      }),
        pendingPromptOut,
      );
    }
  }

  const final = await synthesizeAgentProseAfterTools(
    env,
    messages,
    llmLogContext,
    unwrapVisitorText,
  );
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
    commerceCartView: flowFx.commerceCartView,
    commerceCheckoutStep: flowFx.commerceCheckoutStep,
    flowAssistantAppend: flowFx.flowAssistantAppend,
    checkoutFlowPhase,
    integrationToolsUsed: integrationToolsUsedThisTurn,
    streamHandlers: params.handlers,
    proseAlreadyStreamed: false,
    escalateToHuman: flowFx.escalateToHuman,
    allAgentTools: allTools,
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
