import {
  VISITOR_SESSION_MAX_AGE_DAYS,
  visitorAutocloseIdleSqlOffset,
  visitorSessionIdleSqlOffset,
  verifyStoreCartLink,
  signStoreCartLink,
  type CommerceCart,
  type VisitorSessionContext,
} from "@chatbot/domain";
import type { Env } from "../types";

type ConversationNs = {
  getByName(name: string): { fetch(input: RequestInfo): Promise<Response> };
};

export type PublicMessageRow = {
  role: "user" | "assistant";
  text: string;
};

export async function fetchConversationState(
  conversationNs: ConversationNs,
  orgId: string,
  conversationId: string,
): Promise<{
  phase: string;
  messages: Array<{ role: string; text: string }>;
}> {
  const stub = conversationNs.getByName(`${orgId}:${conversationId}`);
  const res = await stub.fetch(new Request("http://do/state", { method: "GET" }));
  if (!res.ok) return { phase: "automated", messages: [] };
  const data = (await res.json()) as {
    phase: string;
    messages: Array<{ role: string; text: string }>;
  };
  return data;
}

export function mapPublicMessages(
  messages: Array<{ role: string; text: string }>,
): PublicMessageRow[] {
  const out: PublicMessageRow[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", text: m.text });
    else if (m.role === "assistant" || m.role === "human") {
      out.push({ role: "assistant", text: m.text });
    }
  }
  return out;
}

export async function initConversationDo(
  conversationNs: ConversationNs,
  params: {
    orgId: string;
    conversationId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
    visitorContext?: VisitorSessionContext;
    deliveryChannel?: "web" | "store";
  },
): Promise<void> {
  const stub = conversationNs.getByName(`${params.orgId}:${params.conversationId}`);
  const res = await stub.fetch(
    new Request("http://do/init", {
      method: "POST",
      body: JSON.stringify({
        orgId: params.orgId,
        botId: params.botId,
        conversationId: params.conversationId,
        model: params.model,
        systemPrompt: params.systemPrompt,
        hostComponents: params.hostComponents,
        visitorContext: params.visitorContext,
        deliveryChannel: params.deliveryChannel,
      }),
    }),
  );
  if (!res.ok) {
    throw new Error(`do_init_failed:${res.status}`);
  }
}

export async function assertStoreConversationIsStoreChannel(
  env: Env,
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  },
  storeConversationId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const row = await env.DB.prepare(
    `SELECT id FROM conversations
     WHERE id = ? AND org_id = ? AND bot_id = ? AND phase != 'closed'`,
  )
    .bind(storeConversationId, bot.orgId, bot.botId)
    .first<{ id: string }>();
  if (!row) return { ok: false, code: "store_not_found" };

  const stub = env.CONVERSATION.getByName(`${bot.orgId}:${storeConversationId}`);
  const readChannel = async (): Promise<string | null> => {
    const res = await stub.fetch(
      new Request("http://do/delivery-channel", { method: "GET" }),
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { channel?: string };
    return data.channel ?? "web";
  };

  let channel = await readChannel();
  if (channel === null) return { ok: false, code: "store_not_found" };
  if (channel !== "store") {
    await initConversationDo(env.CONVERSATION, {
      orgId: bot.orgId,
      conversationId: storeConversationId,
      botId: bot.botId,
      model: bot.model,
      systemPrompt: bot.systemPrompt,
      hostComponents: bot.hostComponents,
      deliveryChannel: "store",
    });
    channel = await readChannel();
  }
  if (channel !== "store") return { ok: false, code: "not_store_session" };
  return { ok: true };
}

export async function verifyStoreCartAccess(args: {
  env: Env;
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  };
  chatConversationId: string;
  storeConversationId: string;
  storeVisitorId: string;
  storeLinkToken: string;
  chatVisitorId?: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const secret = args.env.ENCRYPTION_KEY?.trim();
  if (!secret) return { ok: false, code: "store_link_unavailable" };

  const storeRow = await args.env.DB.prepare(
    `SELECT visitor_id FROM conversations
     WHERE id = ? AND org_id = ? AND bot_id = ? AND phase != 'closed'`,
  )
    .bind(args.storeConversationId, args.bot.orgId, args.bot.botId)
    .first<{ visitor_id: string | null }>();
  if (!storeRow) return { ok: false, code: "store_not_found" };
  if (!storeRow.visitor_id || storeRow.visitor_id !== args.storeVisitorId) {
    return { ok: false, code: "store_visitor_mismatch" };
  }

  const channelOk = await assertStoreConversationIsStoreChannel(
    args.env,
    args.bot,
    args.storeConversationId,
  );
  if (!channelOk.ok) return channelOk;

  const chatRow = await args.env.DB.prepare(
    `SELECT visitor_id FROM conversations WHERE id = ? AND org_id = ? AND bot_id = ?`,
  )
    .bind(args.chatConversationId, args.bot.orgId, args.bot.botId)
    .first<{ visitor_id: string | null }>();
  if (!chatRow) return { ok: false, code: "chat_not_found" };
  if (args.chatVisitorId?.trim()) {
    if (!chatRow.visitor_id || chatRow.visitor_id !== args.chatVisitorId.trim()) {
      return { ok: false, code: "chat_visitor_mismatch" };
    }
  }

  const link = await verifyStoreCartLink(secret, args.storeLinkToken, {
    storeConversationId: args.storeConversationId,
    chatConversationId: args.chatConversationId,
    storeVisitorId: args.storeVisitorId,
    chatVisitorId: args.chatVisitorId?.trim(),
  });
  if (!link.ok) return link;
  return { ok: true };
}

export async function mintStoreCartLinkToken(args: {
  env: Env;
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  };
  chatConversationId: string;
  storeConversationId: string;
  storeVisitorId: string;
  chatVisitorId: string;
}): Promise<
  { ok: true; storeLinkToken: string } | { ok: false; code: string }
> {
  const secret = args.env.ENCRYPTION_KEY?.trim();
  if (!secret) return { ok: false, code: "store_link_unavailable" };

  const storeRow = await args.env.DB.prepare(
    `SELECT visitor_id FROM conversations
     WHERE id = ? AND org_id = ? AND bot_id = ? AND phase != 'closed'`,
  )
    .bind(args.storeConversationId, args.bot.orgId, args.bot.botId)
    .first<{ visitor_id: string | null }>();
  if (!storeRow) return { ok: false, code: "store_not_found" };
  if (!storeRow.visitor_id || storeRow.visitor_id !== args.storeVisitorId) {
    return { ok: false, code: "store_visitor_mismatch" };
  }

  const channelOk = await assertStoreConversationIsStoreChannel(
    args.env,
    args.bot,
    args.storeConversationId,
  );
  if (!channelOk.ok) return channelOk;

  const chatRow = await args.env.DB.prepare(
    `SELECT visitor_id FROM conversations WHERE id = ? AND org_id = ? AND bot_id = ?`,
  )
    .bind(args.chatConversationId, args.bot.orgId, args.bot.botId)
    .first<{ visitor_id: string | null }>();
  if (!chatRow) return { ok: false, code: "chat_not_found" };
  if (!chatRow.visitor_id) {
    await args.env.DB.prepare(
      `UPDATE conversations SET visitor_id = ? WHERE id = ? AND org_id = ? AND bot_id = ?`,
    )
      .bind(args.chatVisitorId, args.chatConversationId, args.bot.orgId, args.bot.botId)
      .run();
  } else if (chatRow.visitor_id !== args.chatVisitorId) {
    return { ok: false, code: "chat_visitor_mismatch" };
  }

  const storeLinkToken = await signStoreCartLink(secret, {
    storeConversationId: args.storeConversationId,
    chatConversationId: args.chatConversationId,
    storeVisitorId: args.storeVisitorId,
    chatVisitorId: args.chatVisitorId,
  });
  return { ok: true, storeLinkToken };
}

export async function syncLinkedStoreCartToChatDo(args: {
  env: Env;
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  };
  chatConversationId: string;
  storeConversationId: string;
}): Promise<CommerceCart | null> {
  const channelOk = await assertStoreConversationIsStoreChannel(
    args.env,
    args.bot,
    args.storeConversationId,
  );
  if (!channelOk.ok) return null;

  const storeStub = args.env.CONVERSATION.getByName(
    `${args.bot.orgId}:${args.storeConversationId}`,
  );
  const cartRes = await storeStub.fetch(
    new Request("http://do/commerce/cart", { method: "GET" }),
  );
  if (!cartRes.ok) return null;
  const cartData = (await cartRes.json()) as {
    cart?: CommerceCart;
    buyer?: import("@chatbot/domain").CommerceBuyer | null;
    buyerConsentAt?: string | null;
  };
  const cart = cartData.cart ?? null;
  if (!cart) return null;

  await ensurePublicConversationDo(args.env, args.bot, args.chatConversationId);
  const stub = args.env.CONVERSATION.getByName(
    `${args.bot.orgId}:${args.chatConversationId}`,
  );
  await stub.fetch(
    new Request("http://do/sync-linked-store-cart", {
      method: "POST",
      body: JSON.stringify({
        linkedStoreCart: cart,
        storeConversationId: args.storeConversationId,
        linkedStoreBuyer: cartData.buyer ?? null,
        linkedStoreBuyerConsentAt: cartData.buyerConsentAt ?? null,
      }),
    }),
  );
  return cart;
}

export async function fetchStoreCartForChat(
  env: Env,
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  },
  storeConversationId: string,
): Promise<CommerceCart | null> {
  const channelOk = await assertStoreConversationIsStoreChannel(
    env,
    bot,
    storeConversationId,
  );
  if (!channelOk.ok) return null;

  const stub = env.CONVERSATION.getByName(`${bot.orgId}:${storeConversationId}`);
  const res = await stub.fetch(new Request("http://do/commerce/cart", { method: "GET" }));
  if (!res.ok) return null;
  const data = (await res.json()) as { cart?: CommerceCart };
  return data.cart ?? null;
}

/** Idempotente: el carrito y el LLM requieren org/bot en el DO. */
export async function ensurePublicConversationDo(
  env: Env,
  bot: {
    orgId: string;
    botId: string;
    model: string;
    systemPrompt: string;
    hostComponents: string[];
  },
  conversationId: string,
): Promise<void> {
  const payload = {
    orgId: bot.orgId,
    conversationId,
    botId: bot.botId,
    model: bot.model,
    systemPrompt: bot.systemPrompt,
    hostComponents: bot.hostComponents,
  };
  try {
    await initConversationDo(env.CONVERSATION, payload);
  } catch {
    try {
      await initConversationDo(env.CONVERSATION, payload);
    } catch {
      /* último intento en el handler del DO */
    }
  }
}

export async function findResumableConversation(
  db: D1Database,
  orgId: string,
  botId: string,
  visitorId: string,
  explicitId?: string,
): Promise<{ id: string; phase: string } | null> {
  const idle = visitorSessionIdleSqlOffset();
  const maxAge = `-${VISITOR_SESSION_MAX_AGE_DAYS} days`;

  if (explicitId) {
    const row = await db
      .prepare(
        `SELECT id, phase, visitor_id FROM conversations
         WHERE id = ? AND org_id = ? AND bot_id = ?
           AND phase != 'closed'
           AND updated_at >= datetime('now', ?)
           AND created_at >= datetime('now', ?)`,
      )
      .bind(explicitId, orgId, botId, idle, maxAge)
      .first<{ id: string; phase: string; visitor_id: string | null }>();
    if (!row) return null;
    if (row.visitor_id && row.visitor_id !== visitorId) return null;
    return { id: row.id, phase: row.phase };
  }

  const row = await db
    .prepare(
      `SELECT id, phase FROM conversations
       WHERE org_id = ? AND bot_id = ? AND visitor_id = ?
         AND phase != 'closed'
         AND updated_at >= datetime('now', ?)
         AND created_at >= datetime('now', ?)
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .bind(orgId, botId, visitorId, idle, maxAge)
    .first<{ id: string; phase: string }>();

  return row ?? null;
}

export async function touchConversationActivity(
  db: D1Database,
  conversationId: string,
  orgId?: string,
): Promise<void> {
  if (orgId) {
    await db
      .prepare(
        `UPDATE conversations SET updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
      )
      .bind(conversationId, orgId)
      .run();
    return;
  }
  await db
    .prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`)
    .bind(conversationId)
    .run();
}

const IDLE_CLOSE_PHASES = new Set(["automated", "needs_human", "human_active"]);

export async function closeConversationForIdle(
  env: Env,
  orgId: string,
  conversationId: string,
): Promise<void> {
  const conv = await env.DB.prepare(
    `SELECT phase FROM conversations WHERE id = ? AND org_id = ?`,
  )
    .bind(conversationId, orgId)
    .first<{ phase: string }>();
  if (!conv || !IDLE_CLOSE_PHASES.has(conv.phase)) return;
  if (conv.phase === "needs_human" || conv.phase === "human_active") {
    await closeConversationAfterHumanHandoff(env, orgId, conversationId);
    return;
  }
  await closeAutomatedConversation(env, orgId, conversationId);
}

export async function closeAutomatedConversation(
  env: Env,
  orgId: string,
  conversationId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE conversations SET phase = 'closed', updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
  )
    .bind(conversationId, orgId)
    .run();
  try {
    const stub = env.CONVERSATION.getByName(`${orgId}:${conversationId}`);
    await stub.fetch(new Request("http://do/close", { method: "POST" }));
  } catch {
    /* D1 already closed */
  }
}

export async function closeConversationAfterHumanHandoff(
  env: Env,
  orgId: string,
  conversationId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE conversations SET phase = 'closed', updated_at = datetime('now') WHERE id = ? AND org_id = ?`,
  )
    .bind(conversationId, orgId)
    .run();
  await env.DB.prepare(
    `UPDATE human_queue SET status = 'handled' WHERE conversation_id = ? AND org_id = ?`,
  )
    .bind(conversationId, orgId)
    .run();
  try {
    const stub = env.CONVERSATION.getByName(`${orgId}:${conversationId}`);
    await stub.fetch(new Request("http://do/close", { method: "POST" }));
  } catch {
    /* D1 already closed */
  }
}

export async function closeIdleAutomatedConversations(
  env: Env,
): Promise<{ closed: number }> {
  const cutoff = visitorAutocloseIdleSqlOffset();
  const rows = await env.DB.prepare(
    `SELECT id, org_id FROM conversations
     WHERE phase IN ('automated', 'needs_human', 'human_active')
       AND updated_at < datetime('now', ?)`,
  )
    .bind(cutoff)
    .all<{ id: string; org_id: string }>();

  let closed = 0;
  for (const row of rows.results ?? []) {
    await closeConversationForIdle(env, row.org_id, row.id);
    closed += 1;
  }
  return { closed };
}
