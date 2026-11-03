import { DurableObject } from "cloudflare:workers";
import {
  canAutomateReply,
  parseCommerceManifest,
  planFromSlug,
  type CommerceCart,
  type CommerceBuyer,
  type ConversationPhase,
  transitionPhase,
  isRawDeskCommand,
  verifyDeskAction,
  deskCommandDisplayLabel,
  deskCommandToInternal,
  parseInternalDeskCommand,
  META_VISITOR_STRUGGLE_COUNT,
  parseStruggleCount,
  serializePendingPrompt,
  CHECKOUT_FLOW_META_KEY,
  checkoutFlowToVisitorUi,
  parseCheckoutFlow,
  checkoutFlowPromptSection,
  type CheckoutVisitorUi,
  type VisitorCheckoutUi,
  type VisitorStateBarChoice,
  type VisitorTurnKind,
  RAG_METERING_CREDITS_PER_MESSAGE,
} from "@chatbot/domain";
import {
  RAG_CHUNK_MAX_CHARS,
  RAG_CONTEXT_MAX_CHARS,
  RAG_TOP_K,
} from "@chatbot/domain";
import { assertOrgUsage, recordOrgUsage } from "./do-usage";
import { recordOpsSignal, recordOpsVisitorTurn } from "./ops-telemetry";
import {
  embeddingDimensions,
  llmChatCompletion,
  llmChatCompletionStream,
  llmChatWithMessages,
  llmEmbedding,
  llmStreamingEnabled,
  type LlmEnv,
} from "./llm-client";
import { runAgentWithTools, type AgentChatTurn } from "./integrations/agent";
import { agentChatTurnsForLlm } from "./visitor-chat-history";
import { loadBotAgentTools } from "./integrations/load-tools";
import { validateAssistantMessage } from "@chatbot/chat-ui/validate";
import {
  formatVisitorSessionForPrompt,
  type VisitorSessionContext,
} from "@chatbot/domain";
import { buildDeskSystemPrompt } from "./persona-prompt";
import {
  agentFlowToolsEnabled,
  agentDrivenWizardEnabled,
  integrationCodeModeEnabled,
} from "./harness/flags";
import {
  deskTrace,
  deskTraceClip,
  deskTraceRuntimeFlags,
} from "./desk-trace";
import {
  formatSkillsForPrompt,
  loadBotSkills,
} from "./skills/load-bot-skills";
import { visitorMessageForLlmFailure } from "./visitor-chat-errors";
import {
  shouldCompactVisitorHistory,
  summarizeVisitorTranscript,
} from "./harness/conversation-compact";
import { isCatalogHttpTool } from "./commerce/catalog-price";
import { CommerceService } from "./commerce/commerce-service";
import { RAG_CATALOG_BROWSE_HINT_LIMIT } from "./commerce/catalog-search";
import {
  countPublishedProducts,
  getPublishedProduct,
  nativeProductToCatalogEntry,
  formatNativeCatalogPromptSection,
  listPublishedProductsBrowse,
  orgHasPublishedProducts,
} from "./commerce/native-catalog";
import { handleCommerceDoRequest } from "./commerce/do-handlers";
import { appendCartDeskUiFence } from "./commerce/commerce-ui";
import { tryNativeCommerceTurn } from "./commerce/native-commerce-turn";
import {
  clearPendingPrompt,
  PENDING_PROMPT_META_KEY,
  readPendingPrompt,
  resolvePendingPromptBeforeTurn,
  resolvePendingPromptFromDeskOffer,
} from "./pending-prompt-turn";
import { signDeskUiInAssistantText } from "./commerce/desk-action-ui";
import { applyVisitorAssistantActionHarness } from "./commerce/visitor-assistant-harness";
import {
  formatCartForPrompt,
  parseCart,
  emptyCart,
  META_BUYER,
  META_BUYER_CONSENT,
  META_BUYER_CONSENT_POLICY,
  META_LINKED_STORE_CONVERSATION,
  META_LINKED_STORE_CART,
  META_SOURCE_CHANNEL,
} from "./commerce/cart-store";
import {
  classifyVisitorTurn,
  logLlmVisitorFailure,
  logVisitorTurn,
  shouldAttachCommerceTools,
  nativeCatalogPromptCompact,
  type VisitorTurnIntent,
} from "./intent-router";

const HANDOFF_REPLY =
  "Listo. Un asesor revisará este chat en breve. Mientras tanto, puedes seguir escribiendo aquí.";

export interface ConversationEnv extends LlmEnv {
  CONVERSATION?: DurableObjectNamespace;
  VECTORIZE?: VectorizeIndex;
  DB?: D1Database;
  APP_URL?: string;
  PLATFORM_API_URL?: string;
  JWT_SECRET?: string;
  ENCRYPTION_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  CHATBOT_ENV?: string;
  TENANT_CACHE?: KVNamespace;
  ANALYTICS?: AnalyticsEngineDataset;
  HARNESS_SETUP_VERIFY?: string;
  HARNESS_COMPACT_HISTORY?: string;
  LOADER?: import("./integrations/desk-codemode-sandbox").WorkerLoaderBinding;
  DESK_CODEMODE?: {
    get(options: { props: { botId: string } }): import("./integrations/desk-codemode-sandbox").DeskCodemodeRpc;
  };
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "human" | "system";
  text: string;
  at: string;
}

type MessageHandlers = {
  onStatus?: (
    status: import("./visitor-agent-stream").VisitorAgentStreamStatus,
    detail?: { toolName?: string },
  ) => void;
  onStreamStart?: () => void;
  onDelta?: (chunk: string) => void | Promise<void>;
};

export class ConversationDO extends DurableObject<ConversationEnv> {
  phase: ConversationPhase = "automated";
  orgId = "";
  botId = "";
  model = "";
  systemPrompt = "";
  hostComponents: string[] = [];
  private ragCache: { q: string; ctx: string; at: number } | null = null;
  private visitorTurnStartedAt = 0;

  constructor(ctx: DurableObjectState, env: ConversationEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          text TEXT NOT NULL,
          at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      const rows = this.ctx.storage.sql.exec<{ key: string; value: string }>(
        "SELECT key, value FROM meta",
      );
      for (const row of rows) {
        if (row.key === "phase") this.phase = row.value as ConversationPhase;
        if (row.key === "org_id") this.orgId = row.value;
        if (row.key === "bot_id") this.botId = row.value;
        if (row.key === "model") this.model = row.value;
        if (row.key === "system_prompt") this.systemPrompt = row.value;
        if (row.key === "host_components_json") {
          try {
            const list = JSON.parse(row.value) as string[];
            if (Array.isArray(list)) this.hostComponents = list.slice(0, 32);
          } catch {
            this.hostComponents = [];
          }
        }
      }
    });
  }

  private setMeta(key: string, value: string) {
    this.ctx.storage.sql.exec(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  }

  async init(params: {
    orgId: string;
    botId: string;
    conversationId?: string;
    model: string;
    systemPrompt: string;
    hostComponents?: string[];
    visitorContext?: VisitorSessionContext;
    deliveryChannel?: "web" | "store";
  }): Promise<void> {
    this.phase = "automated";
    this.orgId = params.orgId;
    this.botId = params.botId;
    this.model = params.model;
    this.systemPrompt = params.systemPrompt;
    this.hostComponents = params.hostComponents ?? [];
    this.setMeta("org_id", params.orgId);
    this.setMeta("bot_id", params.botId);
    if (params.conversationId) {
      this.setMeta("conversation_id", params.conversationId);
    }
    this.setMeta("model", params.model);
    this.setMeta("system_prompt", params.systemPrompt);
    this.setMeta(
      "host_components_json",
      JSON.stringify(this.hostComponents),
    );
    this.setMeta("phase", this.phase);
    if (params.visitorContext && Object.keys(params.visitorContext).length > 0) {
      this.setMeta("visitor_context_json", JSON.stringify(params.visitorContext));
    }
    if (params.deliveryChannel) {
      const prevChannel = this.getMeta("delivery_channel");
      if (prevChannel !== "store") {
        this.setMeta("delivery_channel", params.deliveryChannel);
        this.setMeta(
          META_SOURCE_CHANNEL,
          params.deliveryChannel === "store" ? "store" : "web",
        );
      }
    }
    this.touchActivity();
  }

  private touchActivity(): void {
    this.setMeta("last_activity_at", new Date().toISOString());
    this.setMeta("idle_warn_sent", "0");
  }

  private sessionSectionForPrompt(): string {
    const raw = this.getMeta("visitor_context_json");
    if (!raw) return "";
    try {
      const ctx = JSON.parse(raw) as VisitorSessionContext;
      return formatVisitorSessionForPrompt(ctx);
    } catch {
      return "";
    }
  }

  private linkedStoreCart(): CommerceCart {
    return parseCart(this.getMeta(META_LINKED_STORE_CART));
  }

  private cartsPromptSection(commerceSvc: CommerceService | null): string {
    const storeLinked = this.getMeta(META_LINKED_STORE_CONVERSATION)?.trim();
    const linked = this.linkedStoreCart();
    if (storeLinked) {
      if (!linked.lines.length) return "";
      return `## Carrito en la tienda\n${formatCartForPrompt(linked)}`;
    }
    const chat = commerceSvc?.getCart() ?? emptyCart();
    const parts: string[] = [];
    if (linked.lines.length && !storeLinked) {
      parts.push(
        `## Carrito en la tienda\n${formatCartForPrompt(linked)}`,
      );
    }
    if (chat.lines.length && !storeLinked) {
      parts.push(formatCartForPrompt(chat));
    }
    return parts.join("\n\n");
  }

  private checkoutFlowSectionForPrompt(
    commerceSvc: CommerceService | null,
  ): string {
    const flow = parseCheckoutFlow(this.getMeta(CHECKOUT_FLOW_META_KEY));
    if (flow.phase === "idle") return "";
    const cart = commerceSvc ? this.cartForUi(commerceSvc) : emptyCart();
    const summary = formatCartForPrompt(cart).trim() || "vacío";
    return checkoutFlowPromptSection(flow, summary);
  }

  private cartForUi(commerceSvc: CommerceService): CommerceCart {
    const storeLinked = this.getMeta(META_LINKED_STORE_CONVERSATION)?.trim();
    if (storeLinked) return this.linkedStoreCart();
    const chat = commerceSvc.getCart();
    if (chat.lines.length) return chat;
    const linked = this.linkedStoreCart();
    return linked.lines.length ? linked : chat;
  }

  async getState(): Promise<{
    phase: ConversationPhase;
    messages: StoredMessage[];
  }> {
    const messages: StoredMessage[] = [];
    for (const row of this.ctx.storage.sql.exec(
      "SELECT id, role, text, at FROM messages ORDER BY at ASC LIMIT 50",
    )) {
      messages.push({
        id: String(row.id),
        role: row.role as StoredMessage["role"],
        text: String(row.text),
        at: String(row.at),
      });
    }
    return { phase: this.phase, messages };
  }

  async appendMessage(
    role: StoredMessage["role"],
    text: string,
  ): Promise<StoredMessage> {
    const msg: StoredMessage = {
      id: crypto.randomUUID(),
      role,
      text,
      at: new Date().toISOString(),
    };
    this.ctx.storage.sql.exec(
      "INSERT INTO messages (id, role, text, at) VALUES (?, ?, ?, ?)",
      msg.id,
      msg.role,
      msg.text,
      msg.at,
    );
    return msg;
  }

  /** Last user/assistant turns for the agent (prose; desk-ui stripped from assistant). */
  private loadAgentChatHistory(): AgentChatTurn[] {
    const turns: AgentChatTurn[] = [];
    for (const row of this.ctx.storage.sql.exec(
      "SELECT role, text FROM messages ORDER BY at ASC LIMIT 48",
    )) {
      const role = String(row.role);
      if (role === "user") {
        turns.push({ role: "user", content: String(row.text) });
      } else if (role === "assistant") {
        turns.push({ role: "assistant", content: String(row.text) });
      }
    }
    return agentChatTurnsForLlm(turns, 24);
  }

  private getStruggleCount(): number {
    return parseStruggleCount(this.getMeta(META_VISITOR_STRUGGLE_COUNT));
  }

  private bumpStruggleCount(delta = 1): void {
    this.setMeta(
      META_VISITOR_STRUGGLE_COUNT,
      String(this.getStruggleCount() + delta),
    );
  }

  private clearStruggleCount(): void {
    this.setMeta(META_VISITOR_STRUGGLE_COUNT, "");
  }

  private visitorCheckoutUi(): CheckoutVisitorUi {
    return checkoutFlowToVisitorUi(
      parseCheckoutFlow(this.getMeta(CHECKOUT_FLOW_META_KEY)),
      { verificationNeeded: false },
    );
  }

  private withVisitorUi<T extends object>(
    result: T,
  ): T & { visitorUi: CheckoutVisitorUi } {
    return { ...result, visitorUi: this.visitorCheckoutUi() };
  }

  private async finishVisitorTurn<
    T extends {
      creditsEstimate: number;
      turnKind?: VisitorTurnKind;
      recordStruggle?: boolean;
      agentDegraded?: boolean;
      llmFailureReason?: string;
    },
  >(result: T): Promise<T & { visitorUi: CheckoutVisitorUi }> {
    await this.recordMessageUsage(result.creditsEstimate);
    const durationMs = this.visitorTurnStartedAt
      ? Math.max(0, Date.now() - this.visitorTurnStartedAt)
      : 0;
    this.visitorTurnStartedAt = 0;
    const metered =
      Math.max(1, result.creditsEstimate) + RAG_METERING_CREDITS_PER_MESSAGE;
    await recordOpsVisitorTurn(this.env.DB, {
      orgId: this.orgId,
      botId: this.botId,
      durationMs,
      creditsMetered: metered,
      degraded: Boolean(result.agentDegraded),
      errorCode:
        result.llmFailureReason ??
        (result.recordStruggle ? "llm_struggle" : null),
    });
    return this.withVisitorUi(result);
  }

  private async visitorAssistantWithHarness(
    text: string,
    opts?: {
      extraChoices?: VisitorStateBarChoice[];
      turnKind?: VisitorTurnKind;
      actionProductId?: string;
      harnessExtraChoices?: VisitorStateBarChoice[];
      recordStruggle?: boolean;
    },
  ): Promise<string> {
    if (opts?.recordStruggle) this.bumpStruggleCount();
    const convId = this.getMeta("conversation_id") ?? "";
    const secret = this.env.ENCRYPTION_KEY ?? "";
    let body = text;
    if (this.env.DB) {
      const hasCatalog = await orgHasPublishedProducts(this.env.DB, this.orgId);
      const svc = this.commerceService();
      const cart = this.cartForUi(svc);
      const cartLineCount = cart.lines.reduce((n, l) => n + l.quantity, 0);
      const checkoutFlow = parseCheckoutFlow(
        this.getMeta(CHECKOUT_FLOW_META_KEY),
      );
      body = applyVisitorAssistantActionHarness({
        text: body,
        phase: this.phase,
        cartLineCount,
        hasPublishedCatalog: hasCatalog,
        turnKind: opts?.turnKind,
        actionProductId: opts?.actionProductId,
        extraChoices: opts?.extraChoices,
        harnessExtraChoices: opts?.harnessExtraChoices,
        struggleCount: this.getStruggleCount(),
        checkoutFlow,
      });
    }
    return signDeskUiInAssistantText(body, convId, secret);
  }

  async handleUserMessage(
    text: string,
    handlers?: MessageHandlers,
    opts?: { deskAction?: string; turnstileToken?: string },
  ): Promise<{
    assistantText: string;
    phase: ConversationPhase;
    creditsEstimate: number;
    checkoutUrl?: string;
    commerceCode?: string;
    visitorUi: VisitorCheckoutUi;
  }> {
    const convId = this.getMeta("conversation_id") ?? "";
    const secret = this.env.ENCRYPTION_KEY ?? "";
    let commandText = text;
    let displayText = text.trim();

    if (opts?.deskAction?.trim()) {
      const verified = await verifyDeskAction(secret, convId, opts.deskAction);
      if (!verified) {
        await this.appendMessage("user", displayText.slice(0, 200));
        const reply = "No pudimos validar esa acción. Usa los botones del chat.";
        await this.appendMessage("assistant", reply);
        return await this.finishVisitorTurn({
          assistantText: reply,
          phase: this.phase,
          creditsEstimate: 0,
        });
      }
      commandText = verified.commandText;
      displayText = verified.displayLabel;

      if (
        verified.cmd.kind === "offer_accept" ||
        verified.cmd.kind === "offer_decline"
      ) {
        const offerResolution = resolvePendingPromptFromDeskOffer(
          verified.cmd.kind,
          (key) => this.getMeta(key),
          (key, value) => this.setMeta(key, value),
        );
        if (offerResolution.type === "missing_pending") {
          const reply = "Esa oferta ya no está activa. Escríbeme si necesitas algo.";
          await this.appendMessage("user", displayText);
          await this.appendMessage("assistant", reply);
          return await this.finishVisitorTurn({
          assistantText: reply,
          phase: this.phase,
          creditsEstimate: 0,
        });
        }
        if (offerResolution.type === "decline") {
          await this.appendMessage("user", displayText);
          this.bumpStruggleCount();
          const assistantText = await this.visitorAssistantWithHarness(
            offerResolution.replyText,
            { turnKind: "faq" },
          );
          await this.appendMessage("assistant", assistantText);
          this.setMeta("phase", this.phase);
          this.touchActivity();
          return await this.finishVisitorTurn({
            assistantText,
            phase: this.phase,
            creditsEstimate: 0,
          });
        }
        if (offerResolution.type === "use_signed_action") {
          await this.appendMessage("user", displayText);
          const cmd = parseInternalDeskCommand(offerResolution.deskCommand);
          const label = cmd
            ? deskCommandDisplayLabel(cmd)
            : "Continuar";
          const assistantText = await this.visitorAssistantWithHarness("", {
            extraChoices: [
              { label, message: offerResolution.deskCommand },
            ],
          });
          await this.appendMessage("assistant", assistantText);
          this.setMeta("phase", this.phase);
          this.touchActivity();
          return await this.finishVisitorTurn({
            assistantText,
            phase: this.phase,
            creditsEstimate: 0,
          });
        }
        if (offerResolution.type === "accept") {
          commandText = offerResolution.deskCommand;
          displayText = deskCommandDisplayLabel(
            parseInternalDeskCommand(offerResolution.deskCommand) ?? {
              kind: "menu",
            },
          );
        }
      } else {
        clearPendingPrompt((key, value) => this.setMeta(key, value));
      }
    } else if (isRawDeskCommand(text)) {
      const rawCmd = parseInternalDeskCommand(text);
      if (rawCmd?.kind === "human") {
        commandText = deskCommandToInternal(rawCmd);
        displayText = deskCommandDisplayLabel(rawCmd);
      } else {
        await this.appendMessage("user", displayText.slice(0, 120));
        const reply = "Usa los botones del chat para continuar.";
        await this.appendMessage("assistant", reply);
        return await this.finishVisitorTurn({
          assistantText: reply,
          phase: this.phase,
          creditsEstimate: 0,
        });
      }
    }

    await this.appendMessage("user", displayText);
    this.touchActivity();
    this.visitorTurnStartedAt = Date.now();

    const traceScope = {
      orgId: this.orgId,
      botId: this.botId,
      conversationId: convId,
    };
    deskTrace(this.env, "visitor.turn_in", {
      displayText: deskTraceClip(displayText, 400),
      commandText: deskTraceClip(commandText, 400),
      phase: this.phase,
      signedDeskAction: Boolean(opts?.deskAction?.trim()),
      flags: deskTraceRuntimeFlags(this.env),
    }, traceScope);

    this.phase = transitionPhase(this.phase, {
      type: "user_message",
      text: displayText,
    });

    const deskCmd = parseInternalDeskCommand(commandText);
    if (deskCmd?.kind === "human") {
      this.phase = "needs_human";
      this.setMeta("phase", this.phase);
      await this.ensureHumanQueueRow();
      const reply = HANDOFF_REPLY;
      await this.appendMessage("assistant", reply);
      this.touchActivity();
      return await this.finishVisitorTurn({
        assistantText: reply,
        phase: this.phase,
        creditsEstimate: 0,
      });
    }

    const pendingResolution = await resolvePendingPromptBeforeTurn({
      env: this.env,
      userMessage: displayText,
      getMeta: (key) => this.getMeta(key),
      setMeta: (key, value) => this.setMeta(key, value),
    });
    if (pendingResolution.type === "decline") {
      this.bumpStruggleCount();
      const assistantText = await this.visitorAssistantWithHarness(
        pendingResolution.replyText,
        { turnKind: "faq" },
      );
      await this.appendMessage("assistant", assistantText);
      this.setMeta("phase", this.phase);
      this.touchActivity();
      return await this.finishVisitorTurn({
        assistantText,
        phase: this.phase,
        creditsEstimate: 0,
      });
    }
    if (pendingResolution.type === "use_signed_action") {
      const cmd = parseInternalDeskCommand(pendingResolution.deskCommand);
      const label = cmd
        ? deskCommandDisplayLabel(cmd)
        : "Continuar";
      const assistantText = await this.visitorAssistantWithHarness(
        pendingResolution.replyText,
        {
          extraChoices: [
            { label, message: pendingResolution.deskCommand },
          ],
        },
      );
      await this.appendMessage("assistant", assistantText);
      this.setMeta("phase", this.phase);
      this.touchActivity();
      return await this.finishVisitorTurn({
        assistantText,
        phase: this.phase,
        creditsEstimate: 0,
      });
    }
    if (pendingResolution.type === "accept") {
      commandText = pendingResolution.deskCommand;
    }

    const channel = this.getMeta("delivery_channel") ?? "web";

    const storeConvId = this.getMeta(META_LINKED_STORE_CONVERSATION)?.trim();
    const fetchLinkedStoreCart =
      storeConvId && this.env.CONVERSATION
        ? async (): Promise<CommerceCart | null> => {
            try {
              const stub = this.env.CONVERSATION!.getByName(
                `${this.orgId}:${storeConvId}`,
              );
              const res = await stub.fetch(
                new Request("http://do/commerce/cart", { method: "GET" }),
              );
              if (!res.ok) return null;
              const data = (await res.json()) as { cart?: CommerceCart };
              return data.cart ?? null;
            } catch {
              return null;
            }
          }
        : undefined;

    if (this.env.DB && (await orgHasPublishedProducts(this.env.DB, this.orgId))) {
      const hasCatalogHttp = await this.botHasCatalogHttpTools();
      const commerceSvc = this.commerceService(hasCatalogHttp, true);
      if (storeConvId) {
        await commerceSvc.pullLinkedStoreMirror();
      }
      const native = await tryNativeCommerceTurn({
        db: this.env.DB,
        orgId: this.orgId,
        text: commandText,
        getMeta: (key) => this.getMeta(key),
        setMeta: (key, value) => this.setMeta(key, value),
        svc: commerceSvc,
        fetchLinkedStoreCart,
        turnstileToken: opts?.turnstileToken,
        agentDrivenWizard: agentDrivenWizardEnabled(this.env),
        agentFlowTools: agentFlowToolsEnabled(this.env),
      });
      if (native) {
        logVisitorTurn({
          orgId: this.orgId,
          conversationId: convId,
          channel,
          intent: classifyVisitorTurn(displayText),
          phase: this.phase,
          handler: "native",
        });
        deskTrace(this.env, "visitor.native_handled", {
          turnKind: native.turnKind,
          commerceCode: native.commerceCode ?? null,
        }, traceScope);
        const assistantText = await this.visitorAssistantWithHarness(
          native.assistantText,
          {
            turnKind: native.turnKind,
            actionProductId: native.actionProductId,
            harnessExtraChoices: native.harnessExtraChoices,
          },
        );
        if (
          native.turnKind === "cart_updated" ||
          native.turnKind === "browse_catalog"
        ) {
          this.clearStruggleCount();
        }
        await this.appendMessage("assistant", assistantText);
        this.setMeta("phase", this.phase);
        this.touchActivity();
        return await this.finishVisitorTurn({
          assistantText,
          phase: this.phase,
          creditsEstimate: 0,
          checkoutUrl: native.checkoutUrl,
          commerceCode: native.commerceCode,
        });
      } else {
        deskTrace(this.env, "visitor.native_skipped", {}, traceScope);
      }
    }

    if (!canAutomateReply(this.phase)) {
      const reply = HANDOFF_REPLY;
      await this.appendMessage("assistant", reply);
      this.setMeta("phase", this.phase);
      await this.ensureHumanQueueRow();
      return await this.finishVisitorTurn({
        assistantText: reply,
        phase: this.phase,
        creditsEstimate: 0,
      });
    }

    const intent = classifyVisitorTurn(commandText);

    handlers?.onStatus?.("thinking");
    logVisitorTurn({
      orgId: this.orgId,
      conversationId: this.getMeta("conversation_id"),
      channel,
      intent,
      phase: this.phase,
      handler: "llm",
    });
    await this.refreshBotPromptFromDb();
    const ragContext = await this.retrieveContext(
      commandText.trim().slice(0, 800),
    );
    const chatHistory = this.loadAgentChatHistory();
    const reply = await this.callLlm(
      commandText,
      intent,
      ragContext,
      handlers,
      chatHistory,
    );
    const svcForUi = this.env.DB ? this.commerceService() : null;
    let assistantBody = reply.text;
    let uiTurnKind =
      reply.turnKind ?? (reply.pendingPrompt ? "pending_offer" : undefined);

    if (reply.escalateToHuman === true) {
      await this.requestHumanHandoff({
        source: "agent.desk_escalate_to_human",
        title: commandText.slice(0, 200),
      });
      this.clearStruggleCount();
      clearPendingPrompt((key, value) => this.setMeta(key, value));
      uiTurnKind = "faq";
    }

    if (reply.pendingPrompt) {
      this.setMeta(
        PENDING_PROMPT_META_KEY,
        serializePendingPrompt(reply.pendingPrompt),
      );
    } else if (uiTurnKind !== "pending_offer") {
      clearPendingPrompt((key, value) => this.setMeta(key, value));
    } else if (!readPendingPrompt((key) => this.getMeta(key))) {
      uiTurnKind = "faq";
    }

    const cartTurn =
      reply.turnKind === "cart_view" || reply.turnKind === "cart_updated";
    let assistantText =
      svcForUi && cartTurn
        ? appendCartDeskUiFence(assistantBody, this.cartForUi(svcForUi))
        : assistantBody;
    assistantText = await this.visitorAssistantWithHarness(assistantText, {
      turnKind: uiTurnKind,
      recordStruggle: reply.recordStruggle,
    });
    if (
      reply.turnKind === "cart_updated" ||
      reply.turnKind === "browse_catalog"
    ) {
      this.clearStruggleCount();
    }
    await this.appendMessage("assistant", assistantText);
    await this.compactVisitorHistoryIfNeeded();
    this.setMeta("phase", this.phase);
    this.touchActivity();
    return await this.finishVisitorTurn({
      assistantText,
      phase: this.phase,
      creditsEstimate: reply.creditsEstimate,
    });
  }

  private async compactVisitorHistoryIfNeeded(): Promise<void> {
    const countRow = this.ctx.storage.sql
      .exec<{ c: number }>("SELECT COUNT(*) as c FROM messages")
      .one();
    const count = countRow?.c ?? 0;
    if (!shouldCompactVisitorHistory(this.env, count)) return;

    const rows: Array<{ role: string; text: string }> = [];
    for (const row of this.ctx.storage.sql.exec(
      "SELECT role, text FROM messages ORDER BY at ASC LIMIT 20",
    )) {
      if (row.role === "user" || row.role === "assistant") {
        rows.push({ role: String(row.role), text: String(row.text) });
      }
    }
    if (rows.length < 12) return;

    const lines = rows.map((r) => `${r.role}: ${r.text.slice(0, 400)}`);
    const summary = await summarizeVisitorTranscript(this.env, lines);
    if (!summary) return;

    const prev = this.getMeta("history_summary") ?? "";
    this.setMeta(
      "history_summary",
      `${prev}\n${summary}`.trim().slice(-4000),
    );

    const keepIds: string[] = [];
    for (const row of this.ctx.storage.sql.exec(
      "SELECT id FROM messages ORDER BY at DESC LIMIT 8",
    )) {
      keepIds.push(String(row.id));
    }
    if (!keepIds.length) return;
    const placeholders = keepIds.map(() => "?").join(",");
    this.ctx.storage.sql.exec(
      `DELETE FROM messages WHERE id NOT IN (${placeholders})`,
      ...keepIds,
    );
  }

  async humanReply(text: string): Promise<void> {
    this.phase = "human_active";
    this.setMeta("phase", this.phase);
    await this.appendMessage("human", text);
    this.touchActivity();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return this.handleWebSocket(request);
    }
    if (url.pathname === "/init" && request.method === "POST") {
      const body = (await request.json()) as {
        orgId: string;
        botId: string;
        conversationId?: string;
        model: string;
        systemPrompt: string;
        hostComponents?: string[];
        visitorContext?: VisitorSessionContext;
        deliveryChannel?: "web";
      };
      await this.init(body);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/delivery-channel" && request.method === "GET") {
      return Response.json({
        channel: this.getMeta("delivery_channel") ?? "web",
      });
    }
    if (url.pathname === "/state" && request.method === "GET") {
      return Response.json(await this.getState());
    }
    if (url.pathname === "/human-reply" && request.method === "POST") {
      const body = (await request.json()) as { text?: string };
      if (!body.text) return new Response("bad_request", { status: 400 });
      await this.humanReply(body.text);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/request-human" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        source?: string;
        title?: string;
      };
      const phase = await this.requestHumanHandoff(body);
      return Response.json({ ok: true, phase });
    }
    if (url.pathname === "/purge" && request.method === "POST") {
      await this.ctx.storage.deleteAll();
      this.phase = "automated";
      this.orgId = "";
      this.botId = "";
      return Response.json({ ok: true });
    }
    if (url.pathname === "/close" && request.method === "POST") {
      this.phase = "closed";
      this.setMeta("phase", "closed");
      return Response.json({ ok: true });
    }
    if (url.pathname === "/record-assistant" && request.method === "POST") {
      const body = (await request.json()) as { text?: string };
      if (!body.text?.trim()) return new Response("bad_request", { status: 400 });
      await this.appendMessage("assistant", body.text.trim());
      this.touchActivity();
      return Response.json({ ok: true });
    }
    if (url.pathname.startsWith("/commerce/")) {
      const hasCatalog = await this.botHasCatalogHttpTools();
      const hasNative =
        this.env.DB
          ? await orgHasPublishedProducts(this.env.DB, this.orgId)
          : false;
      const svc = this.commerceService(hasCatalog, hasNative);
      return handleCommerceDoRequest(svc, request);
    }
    if (url.pathname === "/sync-linked-store-cart" && request.method === "POST") {
      const body = (await request.json()) as {
        linkedStoreCart?: CommerceCart;
        storeConversationId?: string;
        linkedStoreBuyer?: CommerceBuyer | null;
        linkedStoreBuyerConsentAt?: string | null;
      };
      if (body.linkedStoreCart && Array.isArray(body.linkedStoreCart.lines)) {
        this.setMeta(META_LINKED_STORE_CART, JSON.stringify(body.linkedStoreCart));
      }
      if (body.linkedStoreBuyer) {
        this.setMeta(META_BUYER, JSON.stringify(body.linkedStoreBuyer));
      } else if (body.linkedStoreBuyer === null) {
        this.setMeta(META_BUYER, "");
      }
      if (body.linkedStoreBuyerConsentAt?.trim()) {
        this.setMeta(META_BUYER_CONSENT, body.linkedStoreBuyerConsentAt.trim());
        this.setMeta(META_BUYER_CONSENT_POLICY, "desk-ley1581-v1");
      }
      if (body.storeConversationId?.trim()) {
        this.setMeta(
          META_LINKED_STORE_CONVERSATION,
          body.storeConversationId.trim(),
        );
      }
      return Response.json({ ok: true });
    }
    if (url.pathname === "/message" && request.method === "POST") {
      if (this.phase === "closed") {
        return Response.json(
          {
            error: "conversation_closed",
            assistantText: "",
            phase: this.phase,
            creditsEstimate: 0,
          },
          { status: 410 },
        );
      }
      const body = (await request.json()) as {
        text?: string;
        recordOnly?: boolean;
        storeConversationId?: string;
        deskAction?: string;
        turnstileToken?: string;
        stream?: boolean;
      };
      if (!body.text) return new Response("bad_request", { status: 400 });

      if (body.storeConversationId?.trim()) {
        this.setMeta(
          META_LINKED_STORE_CONVERSATION,
          body.storeConversationId.trim(),
        );
      }

      if (body.recordOnly) {
        await this.appendMessage("user", body.text);
        this.touchActivity();
        return Response.json({ ok: true, phase: this.phase });
      }

      const usageError = await this.guardUsage();
      if (usageError) {
        void recordOpsSignal(this.env.DB, {
          severity: "warn",
          category: "usage",
          code: usageError,
          summary: `Tope de uso: ${usageError}`,
          orgId: this.orgId,
          botId: this.botId,
          conversationId: this.getMeta("conversation_id"),
        });
        return Response.json(
          { error: usageError, assistantText: "", phase: this.phase, creditsEstimate: 0 },
          { status: 429 },
        );
      }

      if (body.stream) {
        return this.ndjsonStreamUserMessage({
          text: body.text,
          deskAction: body.deskAction,
          turnstileToken: body.turnstileToken,
        });
      }

      const result = await this.handleUserMessage(body.text, undefined, {
        deskAction: body.deskAction,
        turnstileToken: body.turnstileToken,
      });
      return Response.json(result);
    }
    return new Response("not_found", { status: 404 });
  }

  private ndjsonStreamUserMessage(body: {
    text: string;
    deskAction?: string;
    turnstileToken?: string;
  }): Response {
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const writeLine = async (obj: Record<string, unknown>) => {
      await writer.write(enc.encode(`${JSON.stringify(obj)}\n`));
    };

    this.ctx.waitUntil(
      (async () => {
        try {
          const result = await this.handleUserMessage(
            body.text,
            {
              onStreamStart: () => {
                void writeLine({ type: "start" });
              },
              onStatus: (status, detail) => {
                void writeLine({
                  type: "status",
                  status,
                  toolName: detail?.toolName,
                });
                if (status === "thinking" || status === "tool") {
                  void writeLine({ type: "start" });
                }
              },
              onDelta: async (chunk) => {
                await writeLine({ type: "delta", text: chunk });
              },
            },
            {
              deskAction: body.deskAction,
              turnstileToken: body.turnstileToken,
            },
          );
          await writeLine({
            type: "done",
            assistantText: result.assistantText,
            phase: result.phase,
            creditsEstimate: result.creditsEstimate,
            checkoutUrl: result.checkoutUrl,
            commerceCode: result.commerceCode,
            visitorUi: result.visitorUi,
          });
        } catch {
          await writeLine({
            type: "error",
            error: "message_failed",
            phase: this.phase,
          });
        } finally {
          await writer.close();
        }
      })(),
    );

    return new Response(readable, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  private async guardUsage(): Promise<string | null> {
    const db = this.env.DB;
    if (!db || !this.orgId) return null;
    const org = await db
      .prepare(`SELECT plan_slug, status FROM orgs WHERE id = ?`)
      .bind(this.orgId)
      .first<{ plan_slug: string; status: string }>();
    if (!org || org.status !== "active") return "org_inactive";
    const check = await assertOrgUsage(db, this.orgId, planFromSlug(org.plan_slug), {
      messages: 1,
      credits: 0,
    });
    return check.ok ? null : check.code;
  }

  private async ensureHumanQueueRow(): Promise<void> {
    const db = this.env.DB;
    if (!db || !this.orgId) return;
    const conversationId = this.getMeta("conversation_id");
    if (!conversationId) return;
    await db
      .prepare(
        `INSERT OR IGNORE INTO human_queue (id, org_id, conversation_id, status)
         VALUES (?, ?, ?, 'open')`,
      )
      .bind(crypto.randomUUID(), this.orgId, conversationId)
      .run();
    await db
      .prepare(`UPDATE conversations SET phase = 'needs_human', updated_at = datetime('now') WHERE id = ?`)
      .bind(conversationId)
      .run();
  }

  private broadcastPhase(): void {
    const msg = JSON.stringify({ type: "phase", phase: this.phase });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        // ignore closed sockets
      }
    }
  }

  async requestHumanHandoff(meta?: {
    source?: string;
    title?: string;
  }): Promise<ConversationPhase> {
    const agentInitiated = meta?.source?.startsWith("agent.") === true;
    if (agentInitiated) {
      this.phase = "needs_human";
    } else {
      this.phase = transitionPhase(this.phase, { type: "request_human" });
    }
    this.setMeta("phase", this.phase);
    if (this.phase === "needs_human") {
      await this.ensureHumanQueueRow();
    }
    const note =
      meta?.title?.trim() ||
      (meta?.source === "commerce.intent"
        ? "El visitante pidió hablar con un humano desde una oferta del chat."
        : "");
    if (note) {
      await this.appendMessage("system", note);
    }
    this.broadcastPhase();
    if (this.phase === "needs_human" || this.phase === "human_active") {
      this.touchActivity();
    }
    return this.phase;
  }

  private getMeta(key: string): string | null {
    const rows = this.ctx.storage.sql.exec<{ value: string }>(
      "SELECT value FROM meta WHERE key = ?",
      key,
    );
    for (const row of rows) return String(row.value);
    return null;
  }

  private async recordMessageUsage(creditsEstimate: number): Promise<void> {
    const db = this.env.DB;
    if (!db || !this.orgId) return;
    const org = await db
      .prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
      .bind(this.orgId)
      .first<{ plan_slug: string }>();
    if (!org) return;
    await recordOrgUsage(db, this.orgId, planFromSlug(org.plan_slug), {
      messages: 1,
      credits: creditsEstimate || 1,
    });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "ready", phase: this.phase }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    try {
      const parsed = JSON.parse(text) as { type?: string; text?: string };
      if (parsed.type === "request_human") {
        const phase = await this.requestHumanHandoff({ source: "websocket" });
        ws.send(JSON.stringify({ type: "phase", phase }));
        return;
      }
      if (parsed.type === "user_message" && parsed.text) {
        const usageError = await this.guardUsage();
        if (usageError) {
          ws.send(JSON.stringify({ type: "error", code: usageError }));
          return;
        }

        // Misma ruta que POST /message: el stream por WS rompía respuestas con Workers AI.
        const result = await this.handleUserMessage(parsed.text);

        ws.send(
          JSON.stringify({
            type: "assistant_message",
            text: result.assistantText,
            phase: result.phase,
          }),
        );
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", code: "invalid_payload" }));
    }
  }

  private async refreshBotPromptFromDb(): Promise<void> {
    if (!this.env.DB || !this.botId) return;
    const row = await this.env.DB.prepare(
      `SELECT system_prompt FROM bots WHERE id = ?`,
    )
      .bind(this.botId)
      .first<{ system_prompt: string }>();
    if (row) this.systemPrompt = row.system_prompt ?? "";
  }

  private async retrieveContext(query: string): Promise<string> {
    const index = this.env.VECTORIZE;
    if (!index || !this.orgId) return "";
    const norm = query.trim().toLowerCase().slice(0, 240);
    if (
      this.ragCache &&
      this.ragCache.q === norm &&
      Date.now() - this.ragCache.at < 120_000
    ) {
      return this.ragCache.ctx;
    }
    try {
      const queryVec = await this.embedQuery(query);
      if (!queryVec) return "";
      const filter: VectorizeVectorMetadataFilter = this.botId
        ? { org_id: this.orgId, bot_id: this.botId }
        : { org_id: this.orgId };
      let results = await index.query(queryVec, {
        topK: RAG_TOP_K,
        returnMetadata: "all",
        filter,
      });
      if ((results.matches?.length ?? 0) === 0 && this.botId) {
        results = await index.query(queryVec, {
          topK: RAG_TOP_K,
          returnMetadata: "all",
          filter: { org_id: this.orgId },
        });
      }
      const chunks: string[] = [];
      let total = 0;
      for (const m of results.matches) {
        const raw = m.metadata?.text as string;
        if (!raw) continue;
        const piece = raw.slice(0, RAG_CHUNK_MAX_CHARS);
        if (total + piece.length > RAG_CONTEXT_MAX_CHARS) break;
        chunks.push(piece);
        total += piece.length;
      }
      const ctx = chunks.join("\n---\n");
      this.ragCache = { q: norm, ctx, at: Date.now() };
      return ctx;
    } catch (e) {
      console.error("rag_query_failed", this.orgId, e);
      return "";
    }
  }

  private embeddingDimensions(): number {
    return embeddingDimensions(this.env);
  }

  private async embedQuery(query: string): Promise<number[] | null> {
    const vec = await llmEmbedding(this.env, query.slice(0, 8000));
    if (!vec?.length) return null;
    if (vec.every((v) => v === 0)) return null;
    return vec;
  }

  private async notifyPaymentPending(orderId: string): Promise<void> {
    const base = this.env.PLATFORM_API_URL?.replace(/\/$/, "");
    const secret = this.env.JWT_SECRET;
    if (!base || !secret) return;
    try {
      await fetch(`${base}/v1/internal/commerce/notify-pending-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ orgId: this.orgId, orderId }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch (e) {
      console.error("notify_payment_pending_failed", orderId, e);
    }
  }

  private async botHasCatalogHttpTools(): Promise<boolean> {
    if (!this.env.DB || !this.botId) return false;
    const caps = await this.env.DB.prepare(
      `SELECT DISTINCT o.capability FROM integration_operations o
       JOIN org_integration_instances i ON i.definition_id = o.definition_id
         AND i.pinned_version = o.definition_version
       WHERE i.org_id = ? AND i.enabled = 1 AND i.status = 'connected'
         AND o.capability IN ('catalog.search', 'catalog.get', 'catalog.list_products', 'catalog.get_product')`,
    )
      .bind(this.orgId)
      .first();
    if (caps) return true;
    const rows = await this.env.DB.prepare(
      `SELECT name, description FROM bot_http_tools WHERE bot_id = ? AND enabled = 1`,
    )
      .bind(this.botId)
      .all<{ name: string; description: string }>();
    return (rows.results ?? []).some((r) =>
      isCatalogHttpTool(r.name, r.description ?? ""),
    );
  }

  private commerceService(
    hasCatalogHttpTools = false,
    hasNativeCatalog = false,
  ): CommerceService {
    const conversationId = this.getMeta("conversation_id") ?? "";
    const db = this.env.DB;
    const storeLinked = this.getMeta(META_LINKED_STORE_CONVERSATION)?.trim();
    const channel = this.getMeta("delivery_channel") ?? "web";
    const linkedStore =
      storeLinked && channel !== "store" && this.env.CONVERSATION
        ? {
            storeConversationId: storeLinked,
            fetchStore: (path: string, init?: RequestInit) =>
              this.env.CONVERSATION!.getByName(`${this.orgId}:${storeLinked}`).fetch(
                new Request(`http://do${path}`, init),
              ),
          }
        : undefined;
    return new CommerceService({
      meta: {
        get: (key) => this.getMeta(key),
        set: (key, value) => this.setMeta(key, value),
      },
      db,
      orgId: this.orgId,
      botId: this.botId,
      conversationId,
      hasCatalogHttpTools,
      hasNativeCatalog,
      orderPageBaseUrl: this.env.APP_URL,
      platformApiUrl: this.env.PLATFORM_API_URL,
      encryptionKey: this.env.ENCRYPTION_KEY,
      turnstileSecret: this.env.TURNSTILE_SECRET_KEY,
      checkoutEnv: this.env.CHATBOT_ENV,
      linkedStore,
      onPaymentEvidenceSubmitted: (orderId) =>
        this.notifyPaymentPending(orderId),
      catalogPriceResolver: db
        ? {
            resolvePrice: async (productId: string) => {
              const row = await getPublishedProduct(db, this.orgId, productId);
              return row ? nativeProductToCatalogEntry(row) : null;
            },
          }
        : undefined,
    });
  }

  private async callLlm(
    userText: string,
    intent: VisitorTurnIntent,
    ragContext: string,
    handlers?: MessageHandlers,
    chatHistory: AgentChatTurn[] = [],
  ): Promise<{
    text: string;
    creditsEstimate: number;
    pendingPrompt?: import("@chatbot/domain").PendingPrompt | null;
    turnKind?: VisitorTurnKind;
    recordStruggle?: boolean;
    escalateToHuman?: boolean;
    agentDegraded?: boolean;
    llmFailureReason?: string;
  }> {
    let orgHasCommerce = Boolean(this.env.DB && this.botId);
    if (orgHasCommerce && this.env.DB) {
      const cfg = await this.env.DB.prepare(
        `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
      )
        .bind(this.orgId)
        .first<{ manifest_json: string | null }>();
      const manifest = parseCommerceManifest(cfg?.manifest_json);
      if (
        manifest.commerceProfile === "support_only" &&
        !manifest.nativeInventoryEnabled
      ) {
        orgHasCommerce = false;
      }
    }
    const hasCatalogHttpTools = orgHasCommerce
      ? await this.botHasCatalogHttpTools()
      : false;
    const hasNativeCatalog =
      orgHasCommerce && this.env.DB
        ? await orgHasPublishedProducts(this.env.DB, this.orgId)
        : false;
    const commerceSvc = orgHasCommerce
      ? this.commerceService(hasCatalogHttpTools, hasNativeCatalog)
      : null;
    commerceSvc?.clearCatalogPriceCache();
    const linkedLineCount = this.linkedStoreCart().lines.reduce(
      (n, l) => n + l.quantity,
      0,
    );
    const cartLineCount =
      (commerceSvc?.getCart().lines.reduce((n, l) => n + l.quantity, 0) ?? 0) +
      linkedLineCount;
    const attachCommerce =
      orgHasCommerce &&
      shouldAttachCommerceTools({
        cartLineCount,
        hasNativeCatalog,
        orgHasCommerce,
      });

    let hasHttpTools = false;
    let skillsSection = "";
    if (this.env.DB && this.botId) {
      const loaded = await loadBotAgentTools(
        this.env.DB,
        this.botId,
        this.env.ENCRYPTION_KEY,
      );
      hasHttpTools =
        loaded.length > 0 && (intent !== "small_talk" || attachCommerce);
      const skills = await loadBotSkills(this.env.DB, this.botId, "published");
      skillsSection = formatSkillsForPrompt(skills, "summary");
    }

    let nativeCatalogContext = "";
    if (hasNativeCatalog && this.env.DB && attachCommerce) {
      const rows = await listPublishedProductsBrowse(
        this.env.DB,
        this.orgId,
        RAG_CATALOG_BROWSE_HINT_LIMIT,
      );
      const total = await countPublishedProducts(this.env.DB, this.orgId);
      nativeCatalogContext = formatNativeCatalogPromptSection(rows, {
        compact: nativeCatalogPromptCompact(intent),
        totalPublished: total,
      });
    }
    const llmTraceScope = {
      orgId: this.orgId,
      botId: this.botId,
      conversationId: this.getMeta("conversation_id") ?? undefined,
    };
    const ragForLlm = [ragContext, nativeCatalogContext].filter(Boolean).join("\n\n");
    const cartHint = this.cartsPromptSection(commerceSvc);
    const checkoutFlowHint = this.checkoutFlowSectionForPrompt(commerceSvc);
    const checkoutFlow = parseCheckoutFlow(
      this.getMeta(CHECKOUT_FLOW_META_KEY),
    );
    deskTrace(
      this.env,
      "llm.context_built",
      {
        intent,
        hasHttpTools,
        attachCommerce,
        ragChars: ragContext.length,
        nativeCatalogChars: nativeCatalogContext.length,
        chatHistoryTurns: chatHistory.length,
        checkoutPhase: checkoutFlow.phase,
      },
      llmTraceScope,
    );
    let orgDisplayName: string | null = null;
    if (this.env.DB && this.orgId) {
      const orgRow = await this.env.DB.prepare(
        `SELECT name FROM orgs WHERE id = ?`,
      )
        .bind(this.orgId)
        .first<{ name: string | null }>();
      orgDisplayName = orgRow?.name ?? null;
    }
    const system = buildDeskSystemPrompt({
      companyInstructions: this.systemPrompt,
      orgDisplayName,
      hasTools: hasHttpTools || attachCommerce,
      hasCommerce: attachCommerce,
      hasDocumentContext: Boolean(ragForLlm.trim()),
      allowedHostComponents: this.hostComponents,
      skillsSection,
      sessionSection: this.sessionSectionForPrompt(),
      handoffTriage: this.phase === "handoff_triage",
      integrationCodeMode: integrationCodeModeEnabled(this.env),
    });

    if (this.env.DB && this.botId && (hasHttpTools || attachCommerce)) {
      const agent = await runAgentWithTools(this.env, {
        orgId: this.orgId,
        botId: this.botId,
        conversationId: this.getMeta("conversation_id") ?? undefined,
        system,
        user: userText,
        ragContext: [ragForLlm, cartHint, checkoutFlowHint]
          .filter(Boolean)
          .join("\n\n"),
        chatHistory,
        allowedHostComponents: this.hostComponents,
        commerceService: attachCommerce ? (commerceSvc ?? undefined) : undefined,
        visitorIntent: intent,
        checkoutFlowPhase: checkoutFlow.phase,
        agentFlowTools: agentFlowToolsEnabled(this.env),
        handlers: handlers
          ? {
              onStreamStart: handlers.onStreamStart,
              onDelta: handlers.onDelta,
            }
          : undefined,
      });
      const textOut = agent.text;
      deskTrace(
        this.env,
        "llm.agent_done",
        {
          textChars: textOut.length,
          textPreview: deskTraceClip(textOut, 320),
          credits: agent.creditsEstimate,
          turnKind: agent.turnKind ?? null,
          recordStruggle: agent.recordStruggle ?? false,
        },
        llmTraceScope,
      );
      return {
        text: textOut,
        creditsEstimate: agent.creditsEstimate,
        pendingPrompt: agent.pendingPrompt,
        turnKind: agent.turnKind,
        recordStruggle: agent.recordStruggle,
        escalateToHuman: agent.escalateToHuman,
        agentDegraded: agent.agentDegraded,
        llmFailureReason: agent.llmFailureReason,
      };
    }

    const systemWithRag = [
      system,
      ragForLlm ? `Contexto documental:\n${ragForLlm}` : "",
      cartHint,
    ]
      .filter(Boolean)
      .join("\n\n");

    const turns: AgentChatTurn[] = chatHistory.length
      ? chatHistory
      : [{ role: "user", content: userText }];
    const historyMessages = turns.map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content.slice(0, 3500),
      checkoutFlowHint,
    }));

    const useStream = llmStreamingEnabled(this.env) && Boolean(handlers?.onDelta);

    if (useStream) {
      handlers?.onStreamStart?.();
      let result = await llmChatCompletionStream(this.env, {
        system: systemWithRag,
        user: userText,
        onDelta: (chunk) => handlers?.onDelta?.(chunk),
      });
      if (
        !result.ok ||
        (result.ok && !result.content.trim())
      ) {
        result = await llmChatWithMessages(this.env, {
          messages: [
            { role: "system", content: systemWithRag },
            ...historyMessages,
          ],
        });
      }
      return this.mapLlmResult(result, intent, attachCommerce);
    }

    const llmMessages = [
      { role: "system" as const, content: systemWithRag },
      ...historyMessages,
    ];

    let result = await llmChatWithMessages(this.env, {
      messages: llmMessages,
    });
    if (
      !result.ok &&
      (result.reason === "http_error" || result.reason === "timeout")
    ) {
      result = await llmChatWithMessages(this.env, { messages: llmMessages });
    }
    if (result.ok && !result.content.trim()) {
      result = await llmChatWithMessages(this.env, { messages: llmMessages });
    }
    return this.mapLlmResult(result, intent, attachCommerce);
  }

  private mapLlmResult(
    result:
      | {
          ok: true;
          content: string;
          promptTokens: number;
          completionTokens: number;
        }
      | { ok: false; reason: "not_configured" | "http_error" | "timeout" | "empty_response" },
    intent: VisitorTurnIntent,
    commerceToolsActive = false,
  ): { text: string; creditsEstimate: number } {
    if (!result.ok) {
      logLlmVisitorFailure({
        orgId: this.orgId,
        conversationId: this.getMeta("conversation_id"),
        reason: result.reason,
        intent,
      });
      return {
        text: visitorMessageForLlmFailure(result.reason, {
          commerceToolsActive,
        }),
        creditsEstimate: 0,
      };
    }

    const creditsEstimate = Math.ceil(
      result.promptTokens / 1000 + (result.completionTokens / 1000) * 4,
    );
    const text = validateAssistantMessage(result.content, {
      allowedHostComponents: this.hostComponents,
    }).trim();
    if (!text) {
      return {
        text: visitorMessageForLlmFailure("empty_response", {
          commerceToolsActive,
        }),
        creditsEstimate: 0,
      };
    }
    return { text, creditsEstimate };
  }
}
