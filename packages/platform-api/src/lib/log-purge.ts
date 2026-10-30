import { PLAN_LIMITS, planFromSlug } from "@chatbot/domain";

type ConversationNamespace = {
  getByName(name: string): { fetch(input: RequestInfo): Promise<Response> };
};

async function purgeConversationDo(
  conversationNs: ConversationNamespace,
  orgId: string,
  conversationId: string,
): Promise<void> {
  const stub = conversationNs.getByName(`${orgId}:${conversationId}`);
  await stub.fetch(new Request("http://do/purge", { method: "POST" }));
}

/** Purge conversations older than each org's plan retention (D1 + DO storage). */
export async function purgeExpiredConversations(
  db: D1Database,
  conversationNs?: ConversationNamespace,
): Promise<{ d1Deleted: number; doPurged: number }> {
  const orgs = await db
    .prepare(`SELECT id, plan_slug FROM orgs WHERE status = 'active'`)
    .all<{ id: string; plan_slug: string }>();

  let d1Deleted = 0;
  let doPurged = 0;
  for (const org of orgs.results ?? []) {
    const days = PLAN_LIMITS[planFromSlug(org.plan_slug)].logRetentionDays;
    const cutoff = `-${days} days`;

    const doomed = await db
      .prepare(
        `SELECT id FROM conversations
         WHERE org_id = ? AND updated_at < datetime('now', ?)`,
      )
      .bind(org.id, cutoff)
      .all<{ id: string }>();

    if (conversationNs) {
      for (const row of doomed.results ?? []) {
        try {
          await purgeConversationDo(conversationNs, org.id, row.id);
          doPurged += 1;
        } catch (e) {
          console.error(
            JSON.stringify({
              event: "do_purge_failed",
              orgId: org.id,
              conversationId: row.id,
              error: e instanceof Error ? e.message : String(e),
            }),
          );
        }
      }
    }

    const res = await db
      .prepare(
        `DELETE FROM conversations
         WHERE org_id = ? AND updated_at < datetime('now', ?)`,
      )
      .bind(org.id, cutoff)
      .run();
    d1Deleted += res.meta.changes ?? 0;

    await db
      .prepare(
        `DELETE FROM human_queue
         WHERE org_id = ? AND created_at < datetime('now', ?)`,
      )
      .bind(org.id, cutoff)
      .run();
  }
  return { d1Deleted, doPurged };
}
