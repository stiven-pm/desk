"use client";

import {
  parseAssistantUi,
  sanitizeDeskHtml,
  MAX_HTML_CHARS,
  type DeskUiBlock,
  type ParsedAssistantUi,
  type ProductItem,
} from "@chatbot/chat-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolvePublicApiUrl } from "@/lib/config";
import {
  clearPublicVisitorSession,
  migrateStoreChatSessionSplit,
  publicVisitorStorageKey,
} from "@/lib/public-visitor-session";
import { deskCommandDisplayLabel, isDeskActionToken, isPublicOrderLookupKey, VISITOR_SESSION_IDLE_MINUTES, VISITOR_SESSION_IDLE_WARN_DEFAULT, VISITOR_SESSION_IDLE_WARN_MINUTES } from "@chatbot/domain";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AssistantMarkdown } from "@/components/assistant-markdown";

export type PublicChatBootstrap = {
  orgSlug: string;
  orgName: string;
  botId: string;
  botName: string;
  publishableKey: string;
  themeCssUrl: string | null;
  welcomeMessage: string | null;
  idleReplyMessage?: string | null;
  apiUrl: string;
  turnstileSiteKey?: string | null;
};

export type CheckoutReturnParams = {
  orderToken: string;
  checkoutStatus: string;
  publicRef?: string | null;
  summary?: string | null;
  paymentId?: string | null;
  providerTransactionId?: string | null;
};

const CHECKOUT_IDLE_GRACE_MS = 3 * 60_000;

function checkoutGatewayStorageKey(botId: string): string {
  return `desk:checkout:gateway:${botId}`;
}

function markCheckoutGatewayOpen(botId: string): void {
  sessionStorage.setItem(checkoutGatewayStorageKey(botId), String(Date.now()));
}

function checkoutResultMessage(params: CheckoutReturnParams): string | null {
  const ref = params.publicRef?.trim() || params.orderToken.slice(0, 8);
  const summary = params.summary?.trim();
  if (params.checkoutStatus === "paid") {
    return (
      `*Pago confirmado* — pedido *${ref}*.` +
      (summary ? `\n\n${summary}` : "")
    );
  }
  if (params.checkoutStatus === "failed" || params.checkoutStatus === "cancelled") {
    return `No se completó el pago del pedido *${ref}*.`;
  }
  if (params.checkoutStatus === "awaiting_payment") {
    return `Pedido *${ref}* registrado.` + (summary ? ` ${summary}` : "");
  }
  return null;
}

function threadShowsPaymentForRef(messages: ChatMsg[], publicRef: string): boolean {
  const ref = publicRef.trim();
  if (!ref) return false;
  return messages.some(
    (m) =>
      m.role === "assistant" &&
      m.text.includes(ref) &&
      (m.text.includes("Pago confirmado") || m.text.includes("pago del pedido")),
  );
}

type ChatMsg = { role: "user" | "assistant"; text: string };

const DESK_CHOICE_BTN =
  "rounded-full border border-[#d8dcde] px-3 py-1 text-xs hover:bg-[#f8f9f9]";

function storageKey(botId: string, kind: "visitor" | "conv"): string {
  return publicVisitorStorageKey(botId, kind, "chat");
}

function chatLastActiveKey(botId: string): string {
  return `desk:chat:lastActive:${botId}`;
}

function readChatLastActiveMs(botId: string): number {
  const raw = localStorage.getItem(chatLastActiveKey(botId));
  if (!raw) return Date.now();
  const n = Number(raw);
  return Number.isFinite(n) ? n : Date.now();
}

function writeChatLastActiveMs(botId: string, ms = Date.now()): void {
  localStorage.setItem(chatLastActiveKey(botId), String(ms));
}

const DESK_ACTION_VERIFY_FAIL = "No pudimos validar esa acción";

function AssistantBody({
  text,
  onChoice,
  onOffer,
  onProduct,
}: {
  text: string;
  onChoice: (message: string, label: string) => void;
  onOffer: (offer: {
    intent: "continue" | "pay" | "human";
    title?: string;
    payload?: Record<string, unknown>;
  }) => void;
  onProduct: (message: string, label?: string) => void;
}) {
  const parsed: ParsedAssistantUi = useMemo(() => parseAssistantUi(text), [text]);

  return (
    <div className="space-y-2">
      {parsed.prose ? <AssistantMarkdown text={parsed.prose} /> : null}
      {parsed.blocks.map((block, i) => (
        <DeskBlock
          key={i}
          block={block}
          onChoice={onChoice}
          onOffer={onOffer}
          onProduct={onProduct}
        />
      ))}
    </div>
  );
}

function ProductCatalogPicker({
  buttonLabel,
  items,
  onProduct,
}: {
  buttonLabel: string;
  items: ProductItem[];
  onProduct: (message: string, label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={DESK_CHOICE_BTN}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-black/40"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-3 top-[12dvh] z-[101] mx-auto flex max-h-[76dvh] max-w-md flex-col overflow-hidden rounded-2xl border border-[#d8dcde] bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#d8dcde] px-4 py-3">
              <span className="text-sm font-semibold">{buttonLabel}</span>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-[#68737d] hover:bg-[#f8f9f9]"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {items.map((item, i) => (
                <li key={item.id ?? i}>
                  <button
                    type="button"
                    className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-[#f8f9f9]"
                    onClick={() => {
                      setOpen(false);
                      onProduct(item.prompt ?? item.title, item.title);
                    }}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md bg-[#f8f9f9] object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.title}</span>
                      {item.price ? (
                        <span className="mt-0.5 block text-xs text-[#68737d]">
                          {item.price}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}

function DeskBlock({
  block,
  onChoice,
  onOffer,
  onProduct,
}: {
  block: DeskUiBlock;
  onChoice: (message: string, label: string) => void;
  onOffer: (offer: {
    intent: "continue" | "pay" | "human";
    title?: string;
    payload?: Record<string, unknown>;
  }) => void;
  onProduct: (message: string, label?: string) => void;
}) {
  if (block.type === "choices") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={DESK_CHOICE_BTN}
            onClick={() => onChoice(item.message, item.label)}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }
  if (block.type === "product_catalog") {
    return (
      <ProductCatalogPicker
        buttonLabel={block.buttonLabel}
        items={block.items}
        onProduct={onProduct}
      />
    );
  }
  if (block.type === "products") {
    return (
      <div className="space-y-1.5">
        {block.items.map((item, i) => (
          <button
            key={i}
            type="button"
            className="flex w-full items-baseline justify-between gap-2 rounded-md border border-[#d8dcde] px-3 py-2 text-left text-sm hover:bg-[#f8f9f9]"
            onClick={() => onProduct(item.prompt ?? item.title, item.title)}
          >
            <span className="min-w-0 font-medium">{item.title}</span>
            <span className="shrink-0 text-xs text-[#68737d]">
              {[item.badge, item.price].filter(Boolean).join(" · ") || "Ver"}
            </span>
          </button>
        ))}
      </div>
    );
  }
  if (block.type === "offers") {
    return (
      <div className="space-y-3">
        {block.items.map((item, i) => (
          <div key={i} className="space-y-2">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="max-h-72 w-full rounded-lg bg-[#f8f9f9] object-contain"
              />
            ) : null}
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#68737d]">
                  {item.subtitle}
                </p>
              ) : null}
              {item.compareAtPrice ? (
                <p className="mt-1 text-xs text-[#68737d] line-through">
                  {item.compareAtPrice}
                </p>
              ) : null}
              {item.price ? (
                <p className="text-sm font-semibold">{item.price}</p>
              ) : null}
              {item.badge ? (
                <p className="text-[10px] font-semibold uppercase text-emerald-700">
                  {item.badge}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "html") {
    const safe = sanitizeDeskHtml(block.html, MAX_HTML_CHARS);
    return (
      <div
        className="space-y-2 text-sm text-[#2f3941] [&_img]:mb-2 [&_img]:max-h-72 [&_img]:w-full [&_img]:rounded-lg [&_img]:bg-[#f8f9f9] [&_img]:object-contain [&_p+p]:mt-2"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }
  if (block.type === "cart") {
    return (
      <ul className="space-y-0.5 text-sm">
        {block.lines.map((line) => (
          <li key={line.productId}>
            {line.quantity}× {line.name}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

export function HostedPublicChat({
  bootstrap,
  embed = false,
  storeConversationId = null,
  storeVisitorId = null,
  onLinkedStoreUpdated,
  registerPullLinkedStoreSync,
  checkoutReturn = null,
}: {
  bootstrap: PublicChatBootstrap;
  embed?: boolean;
  /** Carrito de la tienda hosted (otra conversación, misma org). */
  storeConversationId?: string | null;
  /** Visitante de la sesión store (localStorage desk:store:visitor). */
  storeVisitorId?: string | null;
  /** La tienda refresca carrito/comprador cuando el chat muta commerce. */
  onLinkedStoreUpdated?: () => void;
  /** Registra sync store → chat (llamar tras cambios en el panel de la tienda). */
  registerPullLinkedStoreSync?: (sync: (() => Promise<void>) | null) => void;
  /** Vuelta desde Wompi: reconciliar pedido y mostrar estado en el hilo. */
  checkoutReturn?: CheckoutReturnParams | null;
}) {
  const apiUrl = resolvePublicApiUrl(bootstrap.apiUrl);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState("automated");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [turnstilePending, setTurnstilePending] = useState<
    | { kind: "message"; text: string; deskAction?: string }
    | { kind: "pay-intent"; offer: { intent: "pay"; title?: string; payload?: Record<string, unknown> } }
    | null
  >(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Solo hidratar historial al abrir; reanudar sesión no debe pisar mensajes optimistas. */
  const sessionHydrated = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const idleWarnShownRef = useRef(false);
  const storeLinkTokenRef = useRef<string | null>(null);
  const checkoutReturnHandled = useRef(false);
  const checkoutGraceUntilRef = useRef(0);

  const ensureStoreCartLink = useCallback(
    async (chatConversationId: string): Promise<void> => {
      if (!storeConversationId || !storeVisitorId) return;
      const chatVisitorId = localStorage.getItem(storageKey(bootstrap.botId, "visitor"));
      if (!chatVisitorId) return;
      const cacheKey = `desk:storelink:${bootstrap.botId}:${chatConversationId}:${storeConversationId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        storeLinkTokenRef.current = cached;
        return;
      }
      const res = await fetch(
        `${apiUrl}/v1/public/conversations/${chatConversationId}/store-cart-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": bootstrap.publishableKey,
          },
          body: JSON.stringify({
            storeConversationId,
            storeVisitorId,
            chatVisitorId,
          }),
        },
      );
      const data = (await res.json()) as { storeLinkToken?: string; code?: string };
      if (!res.ok || !data.storeLinkToken) {
        sessionStorage.removeItem(cacheKey);
        if (data.code === "chat_visitor_mismatch") {
          localStorage.removeItem(storageKey(bootstrap.botId, "conv"));
          clearPublicVisitorSession(bootstrap.botId, "chat");
        }
        throw new Error(data.code ?? "store_link_failed");
      }
      storeLinkTokenRef.current = data.storeLinkToken;
      sessionStorage.setItem(cacheKey, data.storeLinkToken);
    },
    [
      apiUrl,
      bootstrap.botId,
      bootstrap.publishableKey,
      storeConversationId,
      storeVisitorId,
    ],
  );

  const linkedStoreBody = useCallback(() => {
    if (!storeConversationId || !storeVisitorId) return {};
    const chatVisitorId = localStorage.getItem(storageKey(bootstrap.botId, "visitor"));
    return {
      storeConversationId,
      storeVisitorId,
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(storeLinkTokenRef.current
        ? { storeLinkToken: storeLinkTokenRef.current }
        : {}),
    };
  }, [bootstrap.botId, storeConversationId, storeVisitorId]);

  const ensureSession = useCallback(
    async (opts?: {
      signal?: AbortSignal;
      forceHydrate?: boolean;
    }): Promise<string> => {
      migrateStoreChatSessionSplit(bootstrap.botId);
      const convKey = storageKey(bootstrap.botId, "conv");
      let visitorId = localStorage.getItem(storageKey(bootstrap.botId, "visitor"));
      if (!visitorId || visitorId.length < 8) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(storageKey(bootstrap.botId, "visitor"), visitorId);
      }
      const existingConv = localStorage.getItem(convKey);
      const prevConv = activeConversationIdRef.current ?? existingConv;
      const res = await fetch(`${apiUrl}/v1/public/sessions`, {
        method: "POST",
        signal: opts?.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": bootstrap.publishableKey,
        },
        body: JSON.stringify({
          botId: bootstrap.botId,
          visitorId,
          conversationId: existingConv ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        conversationId?: string;
        visitorId?: string;
        messages?: ChatMsg[];
        phase?: string;
        isNew?: boolean;
        error?: string;
      };
      if (!res.ok || !data.conversationId) {
        throw new Error(data.error ?? "session_failed");
      }
      if (data.visitorId) {
        localStorage.setItem(storageKey(bootstrap.botId, "visitor"), data.visitorId);
      }
      localStorage.setItem(convKey, data.conversationId);
      const convChanged =
        prevConv != null && data.conversationId !== prevConv;
      const shouldHydrate =
        opts?.forceHydrate ||
        !sessionHydrated.current ||
        convChanged ||
        data.isNew === true;
      if (shouldHydrate) {
        setMessages(data.messages?.length ? data.messages : []);
        sessionHydrated.current = true;
        writeChatLastActiveMs(bootstrap.botId);
        idleWarnShownRef.current = false;
      }
      activeConversationIdRef.current = data.conversationId;
      if (data.phase) setPhase(data.phase);
      return data.conversationId;
    },
    [apiUrl, bootstrap.botId, bootstrap.publishableKey],
  );

  useEffect(() => {
    if (!checkoutReturn?.orderToken || !ready || checkoutReturnHandled.current) {
      return;
    }
    checkoutReturnHandled.current = true;
    checkoutGraceUntilRef.current = Date.now() + CHECKOUT_IDLE_GRACE_MS;
    sessionStorage.removeItem(checkoutGatewayStorageKey(bootstrap.botId));
    writeChatLastActiveMs(bootstrap.botId);
    idleWarnShownRef.current = false;

    const params = checkoutReturn;

    const cleanUrl = () => {
      const u = new URL(window.location.href);
      for (const key of [
        "checkout_return",
        "order",
        "checkout_status",
        "public_ref",
        "summary",
        "paymentId",
        "id",
      ]) {
        u.searchParams.delete(key);
      }
      const qs = u.searchParams.toString();
      window.history.replaceState({}, "", qs ? `${u.pathname}?${qs}` : u.pathname);
    };

    void (async () => {
      try {
        if (!isPublicOrderLookupKey(params.orderToken)) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "No pudimos leer el pedido del enlace.",
            },
          ]);
          return;
        }

        sessionHydrated.current = false;
        const conversationId = await ensureSession({ forceHydrate: true });
        const res = await fetch(
          `${apiUrl}/v1/public/conversations/${encodeURIComponent(conversationId)}/messages`,
          { headers: { "X-Api-Key": bootstrap.publishableKey } },
        );
        let nextMessages: ChatMsg[] = [];
        if (res.ok) {
          const data = (await res.json()) as { messages?: ChatMsg[] };
          nextMessages = data.messages?.length ? data.messages : [];
        }

        const ref = params.publicRef?.trim() ?? "";
        const fallback = checkoutResultMessage(params);
        if (
          fallback &&
          !threadShowsPaymentForRef(nextMessages, ref) &&
          (params.checkoutStatus === "paid" ||
            params.checkoutStatus === "failed" ||
            params.checkoutStatus === "cancelled" ||
            params.checkoutStatus === "awaiting_payment")
        ) {
          nextMessages = [...nextMessages, { role: "assistant", text: fallback }];
        }

        setMessages(nextMessages);
        sessionHydrated.current = true;
        writeChatLastActiveMs(bootstrap.botId);
      } finally {
        cleanUrl();
        checkoutGraceUntilRef.current = Date.now() + 60_000;
      }
    })();
  }, [
    apiUrl,
    bootstrap.botId,
    bootstrap.publishableKey,
    checkoutReturn,
    ensureSession,
    ready,
  ]);

  const pullLinkedStoreSync = useCallback(async (): Promise<void> => {
    if (!storeConversationId || !storeVisitorId || !ready) return;
    try {
      const conversationId = await ensureSession();
      await ensureStoreCartLink(conversationId);
      await fetch(
        `${apiUrl}/v1/public/conversations/${conversationId}/sync-linked-store-cart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": bootstrap.publishableKey,
          },
          body: JSON.stringify(linkedStoreBody()),
        },
      );
    } catch {
      /* best-effort */
    }
  }, [
    apiUrl,
    bootstrap.publishableKey,
    ensureSession,
    ensureStoreCartLink,
    linkedStoreBody,
    ready,
    storeConversationId,
    storeVisitorId,
  ]);

  useEffect(() => {
    registerPullLinkedStoreSync?.(pullLinkedStoreSync);
    return () => registerPullLinkedStoreSync?.(null);
  }, [pullLinkedStoreSync, registerPullLinkedStoreSync]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    sessionHydrated.current = false;
    setMessages([]);
    setPhase("automated");
    setError(null);
    setReady(false);

    async function boot() {
      migrateStoreChatSessionSplit(bootstrap.botId);
      const timeout = window.setTimeout(() => {
        if (!cancelled) {
          setError("No pudimos iniciar el chat. Intenta recargar.");
        }
      }, 22_000);

      const run = async (reset: boolean) => {
        if (reset) {
          clearPublicVisitorSession(bootstrap.botId, "chat");
          sessionHydrated.current = false;
        }
        await ensureSession({ signal: ac.signal });
      };

      try {
        await run(false);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (cancelled || ac.signal.aborted) return;
        try {
          await run(true);
          if (!cancelled) {
            setError(null);
            setReady(true);
          }
        } catch {
          if (!cancelled) {
            setError("No pudimos iniciar el chat. Intenta recargar.");
          }
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [bootstrap.botId, ensureSession, sessionEpoch]);

  const startNewConversation = useCallback(() => {
    clearPublicVisitorSession(bootstrap.botId, "chat");
    activeConversationIdRef.current = null;
    idleWarnShownRef.current = false;
    writeChatLastActiveMs(bootstrap.botId);
    sessionHydrated.current = false;
    setReady(false);
    setError(null);
    setMessages([]);
    setPhase("automated");
    setSessionEpoch((n) => n + 1);
  }, [bootstrap.botId]);

  useEffect(() => {
    if (!ready) return;
    const idleMs = VISITOR_SESSION_IDLE_MINUTES * 60_000;
    const warnLeadMs = VISITOR_SESSION_IDLE_WARN_MINUTES * 60_000;

    const checkIdle = () => {
      if (document.visibilityState === "hidden" || busy) return;
      if (checkoutGraceUntilRef.current > Date.now()) return;
      const gatewayRaw = sessionStorage.getItem(
        checkoutGatewayStorageKey(bootstrap.botId),
      );
      if (gatewayRaw) {
        const gatewayAt = Number(gatewayRaw);
        if (
          Number.isFinite(gatewayAt) &&
          Date.now() - gatewayAt < CHECKOUT_IDLE_GRACE_MS
        ) {
          writeChatLastActiveMs(bootstrap.botId);
          return;
        }
        sessionStorage.removeItem(checkoutGatewayStorageKey(bootstrap.botId));
      }
      const elapsed = Date.now() - readChatLastActiveMs(bootstrap.botId);
      if (elapsed >= idleMs) {
        startNewConversation();
        return;
      }
      if (elapsed >= idleMs - warnLeadMs && !idleWarnShownRef.current) {
        idleWarnShownRef.current = true;
        const warnText =
          bootstrap.idleReplyMessage?.trim() || VISITOR_SESSION_IDLE_WARN_DEFAULT;
        setMessages((m) => [...m, { role: "assistant", text: warnText }]);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void ensureSession().then(checkIdle).catch(() => {});
    };

    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(checkIdle, 30_000);
    checkIdle();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [
    bootstrap.botId,
    bootstrap.idleReplyMessage,
    busy,
    ensureSession,
    ready,
    sessionEpoch,
    startNewConversation,
  ]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, busy]);

  useEffect(() => {
    if (!bootstrap.themeCssUrl) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = bootstrap.themeCssUrl;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [bootstrap.themeCssUrl]);

  const turnstileSiteKey = bootstrap.turnstileSiteKey?.trim() || null;
  const humanHeaderLabel = deskCommandDisplayLabel({ kind: "human" });

  const requestHuman = useCallback(async () => {
    if (busy || !ready) return;
    if (phase === "needs_human" || phase === "human_active") return;
    setBusy(true);
    setError(null);
    try {
      const conversationId = await ensureSession();
      const res = await fetch(
        `${apiUrl}/v1/public/conversations/${conversationId}/request-human`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": bootstrap.publishableKey,
          },
          body: "{}",
        },
      );
      if (!res.ok) {
        setError("No pudimos conectar con un asesor. Intenta de nuevo.");
        return;
      }
      const data = (await res.json()) as { phase?: string };
      setPhase(data.phase ?? "needs_human");
    } catch {
      setError("No pudimos conectar con un asesor. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }, [
    apiUrl,
    bootstrap.publishableKey,
    busy,
    ensureSession,
    phase,
    ready,
  ]);

  useEffect(() => {
    if (!storeConversationId || !storeVisitorId || !ready) return;
    let cancelled = false;
    let delayMs = 15_000;
    let timer = 0;

    const schedule = (ms: number) => {
      timer = window.setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        schedule(delayMs);
        return;
      }
      try {
        const conversationId = await ensureSession();
        await ensureStoreCartLink(conversationId);
        await fetch(
          `${apiUrl}/v1/public/conversations/${conversationId}/sync-linked-store-cart`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": bootstrap.publishableKey,
            },
            body: JSON.stringify(linkedStoreBody()),
          },
        );
        delayMs = 15_000;
      } catch {
        delayMs = Math.min(delayMs * 2, 60_000);
      }
      schedule(delayMs);
    };

    schedule(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    apiUrl,
    bootstrap.publishableKey,
    ensureSession,
    ensureStoreCartLink,
    linkedStoreBody,
    ready,
    storeConversationId,
    storeVisitorId,
  ]);

  const sendText = useCallback(
    async (text: string, deskAction?: string, turnstileToken?: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setError(null);
      try {
        let conversationId = await ensureSession();
        if (storeConversationId && storeVisitorId) {
          try {
            await ensureStoreCartLink(conversationId);
          } catch (e) {
            storeLinkTokenRef.current = null;
            if (
              e instanceof Error &&
              e.message === "chat_visitor_mismatch"
            ) {
              conversationId = await ensureSession();
              await ensureStoreCartLink(conversationId);
            }
          }
        }
        setMessages((m) => [...m, { role: "user", text: trimmed }]);
        writeChatLastActiveMs(bootstrap.botId);
        const res = await fetch(
          `${apiUrl}/v1/public/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": bootstrap.publishableKey,
            },
        body: JSON.stringify({
          text: trimmed,
          ...(deskAction ? { deskAction } : {}),
          ...linkedStoreBody(),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
          },
        );
        const data = (await res.json()) as {
          text?: string;
          assistantText?: string;
          phase?: string;
          error?: string;
          checkoutUrl?: string;
          code?: string;
        };
        if (!res.ok) {
          const code = data.code ?? data.error ?? "message_failed";
          if (code === "conversation_closed") {
            startNewConversation();
            return;
          }
          throw new Error(code);
        }
        const reply = data.text ?? data.assistantText ?? "…";
        if (data.checkoutUrl && !reply.includes("Ir a pagar")) {
          markCheckoutGatewayOpen(bootstrap.botId);
          window.location.href = data.checkoutUrl;
          return;
        }
        if (
          data.code === "turnstile_required" &&
          turnstileSiteKey &&
          !turnstileToken
        ) {
          setTurnstilePending(
            deskAction
              ? { kind: "message", text: trimmed, deskAction }
              : { kind: "pay-intent", offer: { intent: "pay" } },
          );
        } else {
          setTurnstilePending(null);
        }
        if (deskAction && reply.includes(DESK_ACTION_VERIFY_FAIL)) {
          startNewConversation();
          return;
        }
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
        writeChatLastActiveMs(bootstrap.botId);
        if (data.phase) setPhase(data.phase);
        if (storeConversationId && storeVisitorId) {
          onLinkedStoreUpdated?.();
        }
      } catch {
        setError("No pudimos enviar el mensaje. Intenta de nuevo.");
      } finally {
        setBusy(false);
      }
    },
    [apiUrl, bootstrap.botId, bootstrap.publishableKey, busy, ensureSession, ensureStoreCartLink, linkedStoreBody, onLinkedStoreUpdated, startNewConversation, storeConversationId, storeVisitorId, turnstileSiteKey],
  );

  const handleOffer = useCallback(
    async (
      offer: {
        intent: "continue" | "pay" | "human";
        title?: string;
        payload?: Record<string, unknown>;
      },
      turnstileToken?: string,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const conversationId = await ensureSession();
        if (storeConversationId && storeVisitorId) {
          try {
            await ensureStoreCartLink(conversationId);
          } catch {
            storeLinkTokenRef.current = null;
          }
        }
        const res = await fetch(
          `${apiUrl}/v1/public/conversations/${conversationId}/commerce-intent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": bootstrap.publishableKey,
            },
            body: JSON.stringify({
              intent: offer.intent,
              title: offer.title,
              payload: offer.payload,
              ...linkedStoreBody(),
              ...(turnstileToken ? { turnstileToken } : {}),
            }),
          },
        );
        const data = (await res.json()) as {
          text?: string;
          phase?: string;
          checkoutUrl?: string;
          code?: string;
          error?: string;
        };
        if (!res.ok) {
          if (
            offer.intent === "pay" &&
            data.code === "turnstile_required" &&
            turnstileSiteKey &&
            !turnstileToken
          ) {
            setTurnstilePending({ kind: "pay-intent", offer: { ...offer, intent: "pay" } });
            return;
          }
          setError(data.code ?? data.error ?? "action_failed");
          return;
        }
        setTurnstilePending(null);
        if (data.checkoutUrl && !(data.text ?? "").includes("Ir a pagar")) {
          markCheckoutGatewayOpen(bootstrap.botId);
          window.location.href = data.checkoutUrl;
          return;
        }
        if (
          offer.intent === "pay" &&
          data.code === "turnstile_required" &&
          turnstileSiteKey &&
          !turnstileToken
        ) {
          setTurnstilePending({ kind: "pay-intent", offer: { ...offer, intent: "pay" } });
        }
        if (data.text) {
          setMessages((m) => [...m, { role: "assistant", text: data.text! }]);
        }
        if (data.phase) setPhase(data.phase);
        if (storeConversationId && storeVisitorId) {
          onLinkedStoreUpdated?.();
        }
      } catch {
        setError("Acción no disponible. Escribe tu pedido en el chat.");
      } finally {
        setBusy(false);
      }
    },
    [apiUrl, bootstrap.publishableKey, ensureSession, ensureStoreCartLink, linkedStoreBody, onLinkedStoreUpdated, storeConversationId, storeVisitorId, turnstileSiteKey],
  );

  async function onTurnstileVerified(token: string) {
    const pending = turnstilePending;
    if (!pending) return;
    setTurnstilePending(null);
    if (pending.kind === "message") {
      await sendText(pending.text, pending.deskAction, token);
    } else {
      await handleOffer(pending.offer, token);
    }
  }

  const shellClass = embed
    ? "flex h-full min-h-0 flex-col overflow-hidden bg-white"
    : "mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white";

  if (error && !ready) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm text-red-800">
        {error}
      </main>
    );
  }

  return (
    <div className={shellClass}>
      {!embed ? (
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[#d8dcde] px-4 py-3">
          <h1 className="min-w-0 text-base font-semibold text-[#2f3941]">
            {bootstrap.orgName}
          </h1>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {phase !== "needs_human" && phase !== "human_active" ? (
              <button
                type="button"
                onClick={() => void requestHuman()}
                disabled={!ready || busy}
                className="rounded-md border border-[#d8dcde] px-2.5 py-1 text-xs text-[#68737d] hover:bg-[#f8f9f9] disabled:opacity-50"
              >
                {humanHeaderLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={startNewConversation}
              disabled={!ready || busy}
              className="rounded-md border border-[#d8dcde] px-2.5 py-1 text-xs text-[#68737d] hover:bg-[#f8f9f9] disabled:opacity-50"
            >
              Empezar de nuevo
            </button>
          </div>
        </header>
      ) : null}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 pb-safe"
      >
        {!ready ? (
          <p className="text-sm text-[#68737d]">Conectando…</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[90%] w-fit rounded-lg bg-[#edf0f2] px-3 py-2 text-sm text-[#2f3941]"
                  : "mr-auto max-w-[95%] w-fit rounded-lg border border-[#d8dcde] bg-white px-3 py-2 text-sm text-[#2f3941]"
              }
            >
              {m.role === "assistant" ? (
                <AssistantBody
                  text={m.text}
                  onChoice={(msg, label) => {
                    if (isDeskActionToken(msg)) void sendText(label, msg);
                    else void sendText(msg);
                  }}
                  onProduct={(msg, label) => {
                    if (isDeskActionToken(msg)) void sendText(label ?? msg, msg);
                    else void sendText(msg);
                  }}
                  onOffer={(o) => void handleOffer(o)}
                />
              ) : (
                m.text
              )}
            </div>
          ))
        )}
        {busy ? (
          <p className="text-xs text-[#68737d]">Escribiendo…</p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[#d8dcde] bg-white">
        {phase === "needs_human" || phase === "human_active" ? (
          <p className="px-4 py-2 text-xs text-[#68737d]">
            Un asesor de {bootstrap.orgName} revisará este chat pronto.
          </p>
        ) : null}

        {error ? (
          <p className="px-4 pb-1 text-xs text-red-700">{error}</p>
        ) : null}

        {turnstilePending && turnstileSiteKey ? (
          <div className="px-4 py-3">
            <TurnstileWidget siteKey={turnstileSiteKey} onToken={(t) => void onTurnstileVerified(t)} />
          </div>
        ) : null}

        {embed ? (
          <div className="flex items-center justify-end gap-2 px-3 pt-1">
            {phase !== "needs_human" && phase !== "human_active" ? (
              <button
                type="button"
                onClick={() => void requestHuman()}
                disabled={!ready || busy}
                className="rounded px-1 py-0.5 text-[11px] text-[#68737d] hover:bg-[#f8f9f9] disabled:opacity-50"
              >
                {humanHeaderLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={startNewConversation}
              disabled={!ready || busy}
              className="rounded px-1 py-0.5 text-[11px] text-[#68737d] hover:bg-[#f8f9f9] disabled:opacity-50"
            >
              Empezar de nuevo
            </button>
          </div>
        ) : null}

      <form
        className="flex gap-2 p-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(input);
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!ready || busy}
          placeholder="Escribe un mensaje…"
          className="min-w-0 flex-1 rounded-md border border-[#d8dcde] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!ready || busy || !input.trim()}
          className="rounded-md bg-[#2f3941] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
      </div>
    </div>
  );
}
