import type { Hono } from "hono";
import {
  commerceIntentBodySchema,
  publicMessageBodySchema,
  publicSessionBodySchema,
  storeCartLinkBodySchema,
  signDeskAction,
} from "@chatbot/domain";
import { publicTurnstileSiteKey } from "../lib/turnstile";
import type { AppEnv } from "../types";
import { apiError, json, randomId } from "../lib/http";
import { clientIp, rateLimitPublic } from "../middleware/rate-limit";
import { requirePublishableBot } from "../lib/public-api-key";
import { loadPublicChatByOrgSlug } from "../lib/public-chat-resolve";
import {
  fetchConversationState,
  findResumableConversation,
  initConversationDo,
  ensurePublicConversationDo,
  mapPublicMessages,
  mintStoreCartLinkToken,
  syncLinkedStoreCartToChatDo,
  touchConversationActivity,
  verifyStoreCartAccess,
} from "../lib/public-conversation";
import { emitOrgWebhook } from "../lib/event-webhooks";

async function loadConversationForAuth(
  env: AppEnv["Bindings"],
  conversationId: string,
  orgId: string,
  botId: string,
): Promise<{ id: string; phase: string } | null> {
  return env.DB.prepare(
    `SELECT id, phase FROM conversations
     WHERE id = ? AND org_id = ? AND bot_id = ?`,
  )
    .bind(conversationId, orgId, botId)
    .first<{ id: string; phase: string }>();
}

async function resolveLinkedStoreForChat(
  c: { env: AppEnv["Bindings"] },
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  },
  chatConversationId: string,
  body: {
    storeConversationId?: string;
    storeVisitorId?: string;
    storeLinkToken?: string;
    chatVisitorId?: string;
  },
): Promise<{ ok: true } | { ok: false; code: string; status: number }> {
  const storeConversationId = body.storeConversationId?.trim();
  if (!storeConversationId) return { ok: true };

  const storeVisitorId = body.storeVisitorId?.trim();
  const storeLinkToken = body.storeLinkToken?.trim();
  const chatVisitorId = body.chatVisitorId?.trim();
  const production = c.env.CHATBOT_ENV === "production";

  if (production && (!storeVisitorId || !storeLinkToken || !chatVisitorId)) {
    return { ok: false, code: "store_link_required", status: 403 };
  }

  if (storeLinkToken && storeVisitorId) {
    const verified = await verifyStoreCartAccess({
      env: c.env,
      bot,
      chatConversationId,
      storeConversationId,
      storeVisitorId,
      storeLinkToken,
      chatVisitorId,
    });
    if (!verified.ok) return { ok: false, code: verified.code, status: 403 };
    return { ok: true };
  }

  if (storeVisitorId) {
    const row = await c.env.DB.prepare(
      `SELECT visitor_id FROM conversations
       WHERE id = ? AND org_id = ? AND bot_id = ? AND phase != 'closed'`,
    )
      .bind(storeConversationId, bot.orgId, bot.botId)
      .first<{ visitor_id: string | null }>();
    if (!row?.visitor_id || row.visitor_id !== storeVisitorId) {
      return { ok: false, code: "store_visitor_mismatch", status: 403 };
    }
    return { ok: true };
  }

  return { ok: false, code: "store_link_required", status: 403 };
}

export function registerPublicChatRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/public/chat/:orgSlug", async (c) => {
    if (await rateLimitPublic(c.env, `chat-boot:${clientIp(c.req.raw)}`, 120)) {
      return apiError("rate_limited", 429);
    }
    const slug = c.req.param("orgSlug").trim();
    if (!slug) return apiError("invalid_slug", 400);

    const loaded = await loadPublicChatByOrgSlug(c.env, slug);
    if (!loaded.ok) {
      if (loaded.error === "inactive") return apiError("org_inactive", 403);
      if (loaded.error === "publishable_key_missing") {
        return apiError("publishable_key_missing", 503);
      }
      return apiError("not_found", 404);
    }

    const { publishableKey, ...rest } = loaded.data;
    return json({
      ...rest,
      publishableKeyPrefix: publishableKey.slice(0, 12),
      publishableKey,
      turnstileSiteKey: publicTurnstileSiteKey(c.env),
    });
  });

  app.post("/v1/public/sessions", async (c) => {
    if (await rateLimitPublic(c.env, `session:${clientIp(c.req.raw)}`, 30)) {
      return apiError("rate_limited", 429);
    }

    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const parsed = publicSessionBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const { botId, conversationId: explicitId, visitorContact: _vc } = parsed.data;
    if (botId !== gate.auth.botId) return apiError("bot_mismatch", 403);

    const sessionChannel =
      parsed.data.channel === "store" ? ("store" as const) : ("web" as const);

    let visitorId = parsed.data.visitorId?.trim();
    if (!visitorId || visitorId.length < 8) {
      visitorId = randomId();
    }

    const bot = gate.bot;
    let conversation = await findResumableConversation(
      c.env.DB,
      bot.orgId,
      bot.botId,
      visitorId,
      explicitId,
    );

    let isNew = false;
    if (!conversation) {
      isNew = true;
      const conversationId = randomId();
      try {
        await c.env.DB.prepare(
          `INSERT INTO conversations (id, org_id, bot_id, visitor_id, phase)
           VALUES (?, ?, ?, ?, 'automated')`,
        )
          .bind(conversationId, bot.orgId, bot.botId, visitorId)
          .run();

        try {
          await initConversationDo(c.env.CONVERSATION, {
            orgId: bot.orgId,
            conversationId,
            botId: bot.botId,
            model: bot.model,
            systemPrompt: bot.systemPrompt,
            hostComponents: bot.hostComponents,
            deliveryChannel: sessionChannel,
          });
        } catch {
          try {
            await initConversationDo(c.env.CONVERSATION, {
              orgId: bot.orgId,
              conversationId,
              botId: bot.botId,
              model: bot.model,
              systemPrompt: bot.systemPrompt,
              hostComponents: bot.hostComponents,
              deliveryChannel: sessionChannel,
            });
          } catch {
            /* La fila en D1 basta; reintenta init en el primer mensaje o carrito. */
          }
        }

        conversation = { id: conversationId, phase: "automated" };

        const welcomeRow = await c.env.DB.prepare(
          `SELECT welcome_message FROM bots WHERE id = ?`,
        )
          .bind(bot.botId)
          .first<{ welcome_message: string | null }>();
        const welcome = welcomeRow?.welcome_message?.trim();
        if (welcome) {
          const stub = c.env.CONVERSATION.getByName(
            `${bot.orgId}:${conversationId}`,
          );
          void stub.fetch(
            new Request("http://do/record-assistant", {
              method: "POST",
              body: JSON.stringify({ text: welcome }),
            }),
          );
        }

        void emitOrgWebhook(c.env, bot.orgId, "conversation.created", {
          conversationId,
          botId: bot.botId,
          channel: sessionChannel,
        });
      } catch {
        conversation =
          (await findResumableConversation(
            c.env.DB,
            bot.orgId,
            bot.botId,
            visitorId,
            conversationId,
          )) ??
          (await findResumableConversation(
            c.env.DB,
            bot.orgId,
            bot.botId,
            visitorId,
          ));
        if (!conversation) return apiError("session_failed", 500);
        isNew = false;
      }
    } else {
      await touchConversationActivity(c.env.DB, conversation.id, bot.orgId);
    }

    await ensurePublicConversationDo(c.env, bot, conversation.id);

    const state = await fetchConversationState(
      c.env.CONVERSATION,
      bot.orgId,
      conversation.id,
    );

    return json({
      conversationId: conversation.id,
      visitorId,
      phase: state.phase || conversation.phase,
      isNew,
      messages: mapPublicMessages(state.messages),
    });
  });

  app.get("/v1/public/conversations/:conversationId/messages", async (c) => {
    if (await rateLimitPublic(c.env, `conv-get:${clientIp(c.req.raw)}`, 120)) {
      return apiError("rate_limited", 429);
    }

    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const conversationId = c.req.param("conversationId");
    const row = await loadConversationForAuth(
      c.env,
      conversationId,
      gate.bot.orgId,
      gate.bot.botId,
    );
    if (!row) return apiError("not_found", 404);

    const state = await fetchConversationState(
      c.env.CONVERSATION,
      gate.bot.orgId,
      conversationId,
    );

    return json({
      conversationId,
      phase: state.phase || row.phase,
      messages: mapPublicMessages(state.messages),
    });
  });

  app.post("/v1/public/conversations/:conversationId/messages", async (c) => {
    if (await rateLimitPublic(c.env, `conv-msg:${clientIp(c.req.raw)}`, 40)) {
      return apiError("rate_limited", 429);
    }

    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const parsed = publicMessageBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const conversationId = c.req.param("conversationId");
    const row = await loadConversationForAuth(
      c.env,
      conversationId,
      gate.bot.orgId,
      gate.bot.botId,
    );
    if (!row) return apiError("not_found", 404);
    if (row.phase === "closed") return apiError("conversation_closed", 410);

    await ensurePublicConversationDo(c.env, gate.bot, conversationId);

    const link = await resolveLinkedStoreForChat(c, gate.bot, conversationId, parsed.data);
    if (!link.ok) return json({ ok: false, code: link.code }, link.status);

    if (parsed.data.storeConversationId) {
      await syncLinkedStoreCartToChatDo({
        env: c.env,
        bot: gate.bot,
        chatConversationId: conversationId,
        storeConversationId: parsed.data.storeConversationId,
      });
    }

    const stub = c.env.CONVERSATION.getByName(
      `${gate.bot.orgId}:${conversationId}`,
    );
    const doRes = await stub.fetch(
      new Request("http://do/message", {
        method: "POST",
        body: JSON.stringify({
          text: parsed.data.text,
          deskAction: parsed.data.deskAction,
          storeConversationId: parsed.data.storeConversationId,
          turnstileToken: parsed.data.turnstileToken,
          stream: parsed.data.stream === true,
        }),
      }),
    );

    if (parsed.data.stream && doRes.ok) {
      const ct = doRes.headers.get("content-type") ?? "";
      if (ct.includes("ndjson")) {
        await touchConversationActivity(c.env.DB, conversationId, gate.bot.orgId);
        void emitOrgWebhook(c.env, gate.bot.orgId, "conversation.message", {
          conversationId,
          botId: gate.bot.botId,
          channel: "web",
          role: "user",
        });
        return new Response(doRes.body, {
          status: doRes.status,
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
        });
      }
    }

    const data = (await doRes.json()) as {
      assistantText?: string;
      text?: string;
      phase?: string;
      error?: string;
      creditsEstimate?: number;
    };

    if (!doRes.ok) {
      return json(
        {
          error: data.error ?? "message_failed",
          text: data.assistantText ?? "",
          phase: data.phase ?? row.phase,
        },
        doRes.status,
      );
    }

    await touchConversationActivity(c.env.DB, conversationId, gate.bot.orgId);

    void emitOrgWebhook(c.env, gate.bot.orgId, "conversation.message", {
      conversationId,
      botId: gate.bot.botId,
      channel: "web",
      role: "user",
    });

    const assistantText = data.assistantText ?? data.text ?? "";
    return json({
      text: assistantText,
      assistantText,
      phase: data.phase ?? row.phase,
      creditsEstimate: data.creditsEstimate ?? 0,
      checkoutUrl: (data as { checkoutUrl?: string }).checkoutUrl,
      code: (data as { commerceCode?: string }).commerceCode,
      visitorUi: (data as { visitorUi?: { requiresTurnstile: boolean } })
        .visitorUi,
    });
  });

  app.post("/v1/public/conversations/:conversationId/commerce-intent", async (c) => {
    if (await rateLimitPublic(c.env, `commerce:${clientIp(c.req.raw)}`, 30)) {
      return apiError("rate_limited", 429);
    }

    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const parsed = commerceIntentBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const conversationId = c.req.param("conversationId");
    const row = await loadConversationForAuth(
      c.env,
      conversationId,
      gate.bot.orgId,
      gate.bot.botId,
    );
    if (!row) return apiError("not_found", 404);

    await ensurePublicConversationDo(c.env, gate.bot, conversationId);

    const stub = c.env.CONVERSATION.getByName(
      `${gate.bot.orgId}:${conversationId}`,
    );
    const { intent, title, itemId, payload } = parsed.data;

    void emitOrgWebhook(c.env, gate.bot.orgId, "commerce.intent", {
      conversationId,
      botId: gate.bot.botId,
      intent,
      title: title ?? null,
      itemId: itemId ?? null,
      payload: payload ?? {},
    });

    if (intent === "human") {
      const res = await stub.fetch(
        new Request("http://do/request-human", {
          method: "POST",
          body: JSON.stringify({
            source: "commerce.intent",
            title: title ?? "El visitante pidió un asesor.",
          }),
        }),
      );
      const body = (await res.json()) as { phase?: string };
      return json({ ok: true, phase: body.phase ?? row.phase });
    }

    if (intent === "pay") {
      const link = await resolveLinkedStoreForChat(c, gate.bot, conversationId, parsed.data);
      if (!link.ok) return json({ ok: false, code: link.code }, link.status);
      if (parsed.data.storeConversationId) {
        await syncLinkedStoreCartToChatDo({
          env: c.env,
          bot: gate.bot,
          chatConversationId: conversationId,
          storeConversationId: parsed.data.storeConversationId,
        });
      }
      const payAction = await signDeskAction(
        c.env.ENCRYPTION_KEY ?? "",
        conversationId,
        { kind: "pay" },
      );
      const msgRes = await stub.fetch(
        new Request("http://do/message", {
          method: "POST",
          body: JSON.stringify({
            text: "Pagar",
            deskAction: payAction,
            storeConversationId: parsed.data.storeConversationId,
            turnstileToken: parsed.data.turnstileToken,
          }),
        }),
      );
      const payMsg = (await msgRes.json()) as {
        assistantText?: string;
        checkoutUrl?: string;
        phase?: string;
        error?: string;
      };
      if (!msgRes.ok) {
        return json(
          { ok: false, error: payMsg.error ?? "message_failed" },
          msgRes.status,
        );
      }
      if (payMsg.checkoutUrl) {
        return json({ ok: true, checkoutUrl: payMsg.checkoutUrl });
      }
      return json({
        ok: true,
        text: payMsg.assistantText ?? "",
        phase: payMsg.phase ?? row.phase,
        code: (payMsg as { commerceCode?: string }).commerceCode,
        visitorUi: (payMsg as { visitorUi?: { requiresTurnstile: boolean } })
          .visitorUi,
      });
    }

    const userText =
      title?.trim() ||
      (itemId ? `Quiero ${itemId}` : "Continuar con esta opción");
    const link = await resolveLinkedStoreForChat(c, gate.bot, conversationId, parsed.data);
    if (!link.ok) return json({ ok: false, code: link.code }, link.status);
    if (parsed.data.storeConversationId) {
      await syncLinkedStoreCartToChatDo({
        env: c.env,
        bot: gate.bot,
        chatConversationId: conversationId,
        storeConversationId: parsed.data.storeConversationId,
      });
    }
    const msgRes = await stub.fetch(
      new Request("http://do/message", {
        method: "POST",
        body: JSON.stringify({
          text: userText,
          storeConversationId: parsed.data.storeConversationId,
        }),
      }),
    );
    const msg = (await msgRes.json()) as {
      assistantText?: string;
      phase?: string;
      error?: string;
    };
    if (!msgRes.ok) {
      return json({ ok: false, error: msg.error ?? "message_failed" }, msgRes.status);
    }
    return json({
      ok: true,
      text: msg.assistantText ?? "",
      phase: msg.phase ?? row.phase,
    });
  });

  app.post("/v1/public/conversations/:conversationId/request-human", async (c) => {
    if (await rateLimitPublic(c.env, `human:${clientIp(c.req.raw)}`, 20)) {
      return apiError("rate_limited", 429);
    }

    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const conversationId = c.req.param("conversationId");
    const row = await loadConversationForAuth(
      c.env,
      conversationId,
      gate.bot.orgId,
      gate.bot.botId,
    );
    if (!row) return apiError("not_found", 404);

    const stub = c.env.CONVERSATION.getByName(
      `${gate.bot.orgId}:${conversationId}`,
    );
    const res = await stub.fetch(
      new Request("http://do/request-human", {
        method: "POST",
        body: JSON.stringify({ source: "web" }),
      }),
    );
    const body = (await res.json()) as { phase?: string };
    void emitOrgWebhook(c.env, gate.bot.orgId, "conversation.handoff", {
      conversationId,
      botId: gate.bot.botId,
      channel: "web",
    });
    return json({ ok: true, phase: body.phase ?? row.phase });
  });

  app.post(
    "/v1/public/conversations/:conversationId/store-cart-link",
    async (c) => {
      if (await rateLimitPublic(c.env, `store-link:${clientIp(c.req.raw)}`, 30)) {
        return apiError("rate_limited", 429);
      }

      const gate = await requirePublishableBot(c);
      if (!gate.ok) return gate.response;

      const parsed = storeCartLinkBodySchema.safeParse(await c.req.json());
      if (!parsed.success) return apiError("invalid_body", 400);

      const chatConversationId = c.req.param("conversationId");
      const row = await loadConversationForAuth(
        c.env,
        chatConversationId,
        gate.bot.orgId,
        gate.bot.botId,
      );
      if (!row) return apiError("not_found", 404);

      const minted = await mintStoreCartLinkToken({
        env: c.env,
        bot: gate.bot,
        chatConversationId,
        storeConversationId: parsed.data.storeConversationId,
        storeVisitorId: parsed.data.storeVisitorId,
        chatVisitorId: parsed.data.chatVisitorId,
      });
      if (!minted.ok) return json({ ok: false, code: minted.code }, 403);
      return json({ ok: true, storeLinkToken: minted.storeLinkToken });
    },
  );

  app.post(
    "/v1/public/conversations/:conversationId/sync-linked-store-cart",
    async (c) => {
      if (await rateLimitPublic(c.env, `sync-cart:${clientIp(c.req.raw)}`, 120)) {
        return apiError("rate_limited", 429);
      }

      const gate = await requirePublishableBot(c);
      if (!gate.ok) return gate.response;

      const body = (await c.req.json()) as {
        storeConversationId?: string;
        storeVisitorId?: string;
        storeLinkToken?: string;
      };
      const conversationId = c.req.param("conversationId");
      const row = await loadConversationForAuth(
        c.env,
        conversationId,
        gate.bot.orgId,
        gate.bot.botId,
      );
      if (!row) return apiError("not_found", 404);

      const link = await resolveLinkedStoreForChat(c, gate.bot, conversationId, body);
      if (!link.ok) return json({ ok: false, code: link.code }, link.status);

      const storeConversationId = body.storeConversationId?.trim();
      if (!storeConversationId) return apiError("invalid_body", 400);

      const cart = await syncLinkedStoreCartToChatDo({
        env: c.env,
        bot: gate.bot,
        chatConversationId: conversationId,
        storeConversationId,
      });
      if (!cart) {
        return json({ ok: true, synced: false });
      }

      return json({ ok: true, synced: true, cart });
    },
  );
}
