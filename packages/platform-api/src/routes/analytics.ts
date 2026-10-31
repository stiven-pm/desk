import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireUser } from "../lib/auth";
import { json } from "../lib/http";
import { getUsage } from "../lib/usage";
import { PLAN_LIMITS, planFromSlug, bucketConversationsByLocalDay, resolveOrgTimezone } from "@chatbot/domain";

export function registerAnalyticsRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/analytics", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const org = await c.env.DB.prepare(
      `SELECT plan_slug, status, timezone FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ plan_slug: string; status: string; timezone?: string | null }>();

    const orgTimezone = resolveOrgTimezone(org?.timezone);

    const usage = await getUsage(c.env, auth.user.orgId!);
    const limits = PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];

    const [
      conv30,
      handoffs30,
      docs,
      tools,
      ordersPaid,
      checkouts,
      revenue,
      ordersAll30,
      conv7,
    ] = await Promise.all([
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM conversations WHERE org_id = ? AND created_at > datetime('now', '-30 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM human_queue WHERE org_id = ? AND created_at > datetime('now', '-30 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM sources WHERE org_id = ? AND status = 'ready'`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM bot_http_tools t JOIN bots b ON b.id = t.bot_id WHERE b.org_id = ? AND t.enabled = 1`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM sales_orders WHERE org_id = ? AND status = 'paid' AND created_at > datetime('now', '-30 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM commerce_events WHERE org_id = ? AND name = 'checkout.started' AND created_at > datetime('now', '-30 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COALESCE(SUM(subtotal_cents), 0) as n FROM sales_orders
         WHERE org_id = ? AND status = 'paid' AND created_at > datetime('now', '-30 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM sales_orders WHERE org_id = ? AND created_at > datetime('now', '-30 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM conversations WHERE org_id = ? AND created_at > datetime('now', '-7 days')`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>(),
    ]);

    const paid = ordersPaid?.n ?? 0;
    const started = checkouts?.n ?? 0;
    const conversionPct =
      started > 0 ? Math.round((paid / started) * 1000) / 10 : null;
    const aiHandledEstimate = Math.max(0, (conv30?.n ?? 0) - (handoffs30?.n ?? 0));

    const dailyRows = await c.env.DB.prepare(
      `SELECT created_at FROM conversations
       WHERE org_id = ? AND created_at > datetime('now', '-16 days')`,
    )
      .bind(auth.user.orgId)
      .all<{ created_at: string }>();

    const conversationsByDay = bucketConversationsByLocalDay(
      dailyRows.results ?? [],
      orgTimezone,
      { maxDays: 14 },
    );

    return json({
      orgStatus: org?.status,
      planSlug: org?.plan_slug,
      reportingTimezone: orgTimezone,
      usage,
      limits,
      summary: {
        conversationsLast30Days: conv30?.n ?? 0,
        handoffsLast30Days: handoffs30?.n ?? 0,
        readyDocuments: docs?.n ?? 0,
        activeHttpTools: tools?.n ?? 0,
        ordersPaidLast30Days: paid,
        checkoutsStartedLast30Days: started,
        ordersTotalLast30Days: ordersAll30?.n ?? 0,
        revenuePaidCentsLast30Days: revenue?.n ?? 0,
        conversationsLast7Days: conv7?.n ?? 0,
        clientMessagesThisMonth: usage.messagesCount,
        checkoutConversionPct: conversionPct,
        conversationsHandledByAiEstimate: aiHandledEstimate,
      },
      conversationsByDay,
    });
  });
}
