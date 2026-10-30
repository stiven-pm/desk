import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdminRole } from "../lib/auth";
import { apiError, json } from "../lib/http";
import { fetchConversationState, closeConversationAfterHumanHandoff } from "../lib/public-conversation";
import { formatVisitorContactLabel } from "../lib/visitor-contact";

const AGENT_ROLES = ["owner", "admin", "agent"];

export function registerHumanRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/inbox", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, AGENT_ROLES);
    if ("response" in auth) return auth.response;

    const rows = await c.env.DB.prepare(
      `SELECT h.id, h.conversation_id, h.status, h.created_at, h.summary,
              conv.bot_id, conv.phase, conv.visitor_id,
              conv.visitor_dial_code, conv.visitor_phone
       FROM human_queue h
       JOIN conversations conv ON conv.id = h.conversation_id
       WHERE h.rowid = (
         SELECT MIN(h2.rowid) FROM human_queue h2
         WHERE h2.org_id = h.org_id AND h2.conversation_id = h.conversation_id
       )
         AND h.org_id = ? AND h.status = 'open' AND conv.phase = 'needs_human'
       ORDER BY conv.updated_at DESC
       LIMIT 50`,
    )
      .bind(auth.user.orgId)
      .all<{
        id: string;
        conversation_id: string;
        status: string;
        created_at: string;
        summary: string | null;
        bot_id: string;
        phase: string;
        visitor_id: string | null;
        visitor_dial_code: string | null;
        visitor_phone: string | null;
      }>();

    const items: Array<Record<string, unknown>> = [];
    for (const row of rows.results ?? []) {
      const state = await fetchConversationState(
        c.env.CONVERSATION,
        auth.user.orgId!,
        row.conversation_id,
      );
      if (state.phase !== "needs_human" && state.phase !== "human_active") {
        await c.env.DB.prepare(
          `UPDATE human_queue SET status = 'handled' WHERE org_id = ? AND conversation_id = ? AND status = 'open'`,
        )
          .bind(auth.user.orgId, row.conversation_id)
          .run();
        if (row.phase !== state.phase) {
          await c.env.DB.prepare(
            `UPDATE conversations SET phase = ? WHERE id = ? AND org_id = ?`,
          )
            .bind(state.phase, row.conversation_id, auth.user.orgId)
            .run();
        }
        continue;
      }
      items.push({
        ...row,
        display_contact: formatVisitorContactLabel(
          row.visitor_id,
          row.visitor_phone,
          row.conversation_id,
        ),
      });
    }

    return json({ items });
  });

  app.get("/v1/admin/inbox/:conversationId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, AGENT_ROLES);
    if ("response" in auth) return auth.response;

    const conversationId = c.req.param("conversationId");
    const conv = await c.env.DB.prepare(
      `SELECT id, phase, visitor_id, visitor_phone, bot_id, updated_at
       FROM conversations WHERE id = ? AND org_id = ?`,
    )
      .bind(conversationId, auth.user.orgId)
      .first<{
        id: string;
        phase: string;
        visitor_id: string | null;
        visitor_phone: string | null;
        bot_id: string;
        updated_at: string;
      }>();
    if (!conv) return apiError("not_found", 404);

    const state = await fetchConversationState(
      c.env.CONVERSATION,
      auth.user.orgId,
      conversationId,
    );

    const displayContact = formatVisitorContactLabel(
      conv.visitor_id,
      conv.visitor_phone,
      conv.id,
    );

    return json({
      conversation: {
        id: conv.id,
        phase: conv.phase,
        botId: conv.bot_id,
        customerPhone: conv.visitor_phone ?? null,
        displayContact,
        updatedAt: conv.updated_at,
      },
      phase: state.phase,
      messages: state.messages,
    });
  });

  app.post("/v1/admin/inbox/:conversationId/reply", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, AGENT_ROLES);
    if ("response" in auth) return auth.response;

    const body = (await c.req.json()) as { text?: string };
    if (!body.text?.trim()) return apiError("invalid_body", 400);

    const conversationId = c.req.param("conversationId");
    const conv = await c.env.DB.prepare(
      `SELECT org_id, bot_id FROM conversations WHERE id = ? AND org_id = ?`,
    )
      .bind(conversationId, auth.user.orgId)
      .first<{ org_id: string; bot_id: string }>();
    if (!conv) return apiError("not_found", 404);

    const stub = c.env.CONVERSATION.getByName(
      `${conv.org_id}:${conversationId}`,
    );
    await stub.fetch(
      new Request("http://do/human-reply", {
        method: "POST",
        body: JSON.stringify({ text: body.text.trim() }),
      }),
    );

    await closeConversationAfterHumanHandoff(c.env, auth.user.orgId, conversationId);

    await c.env.DB.prepare(
      `INSERT INTO audit_log (org_id, actor_user_id, action, meta_json) VALUES (?, ?, 'human_reply', ?)`,
    )
      .bind(
        auth.user.orgId,
        auth.user.id,
        JSON.stringify({ conversationId, closed: true }),
      )
      .run();

    return json({ ok: true });
  });

  app.post("/v1/admin/inbox/:conversationId/dismiss", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, AGENT_ROLES);
    if ("response" in auth) return auth.response;

    const conversationId = c.req.param("conversationId");
    const conv = await c.env.DB.prepare(
      `SELECT id, phase FROM conversations WHERE id = ? AND org_id = ?`,
    )
      .bind(conversationId, auth.user.orgId)
      .first<{ id: string; phase: string }>();
    if (!conv) return apiError("not_found", 404);
    if (conv.phase !== "needs_human") {
      return apiError("invalid_state", 400);
    }

    await closeConversationAfterHumanHandoff(c.env, auth.user.orgId, conversationId);
    await c.env.DB.prepare(
      `INSERT INTO audit_log (org_id, actor_user_id, action, meta_json) VALUES (?, ?, 'human_dismiss', ?)`,
    )
      .bind(
        auth.user.orgId,
        auth.user.id,
        JSON.stringify({ conversationId }),
      )
      .run();

    return json({ ok: true });
  });
}
