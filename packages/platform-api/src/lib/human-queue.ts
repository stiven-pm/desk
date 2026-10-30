import type { Env } from "../types";
import { randomId } from "./http";
import { fetchConversationState } from "./public-conversation";
import { buildHandoffSummary } from "./handoff-summary";

export async function ensureHumanQueueItem(
  env: Env,
  orgId: string,
  conversationId: string,
): Promise<void> {
  let summary = "";
  try {
    const state = await fetchConversationState(env.CONVERSATION, orgId, conversationId);
    summary = await buildHandoffSummary(env, state.messages);
  } catch {
    summary = "";
  }

  await env.DB.prepare(
    `INSERT INTO human_queue (id, org_id, conversation_id, status, summary)
     VALUES (?, ?, ?, 'open', ?)
     ON CONFLICT(org_id, conversation_id) DO UPDATE SET
       status = 'open',
       summary = COALESCE(excluded.summary, human_queue.summary)`,
  )
    .bind(randomId(), orgId, conversationId, summary || null)
    .run();
  await env.DB.prepare(
    `UPDATE conversations SET phase = 'needs_human', updated_at = datetime('now')
     WHERE id = ? AND phase NOT IN ('human_active', 'closed')`,
  )
    .bind(conversationId)
    .run();
}

/** Mantiene el hilo visible en el panel cuando el cliente escribe con la IA en pausa. */
export async function reopenHumanQueueOnCustomerMessage(
  env: Env,
  orgId: string,
  conversationId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO human_queue (id, org_id, conversation_id, status, summary)
     VALUES (?, ?, ?, 'open', NULL)
     ON CONFLICT(org_id, conversation_id) DO UPDATE SET status = 'open'`,
  )
    .bind(randomId(), orgId, conversationId)
    .run();
}
