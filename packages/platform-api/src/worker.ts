import { createApp } from "./app";
import type { Env } from "./types";
import { ConversationDO } from "@chatbot/runtime";
import { processIngestJob, type IngestQueueMessage } from "./lib/ingest";
import { periodStartIso } from "./lib/http";
import { purgeExpiredConversations } from "./lib/log-purge";
import { closeIdleAutomatedConversations } from "./lib/public-conversation";
import { proxyPublicConversationWebSocket } from "./lib/public-websocket";
import { processEnterpriseShellQueue } from "./lib/enterprise-shell-worker";
import { syncBuiltinIntegrationTemplates } from "./lib/builtin-integrations";

export { ConversationDO };

const app = createApp();

let builtinIntegrationsSync: Promise<void> | null = null;

function ensureBuiltinIntegrations(env: Env): Promise<void> {
  if (!builtinIntegrationsSync) {
    builtinIntegrationsSync = syncBuiltinIntegrationTemplates(env).catch(
      (err) => {
        builtinIntegrationsSync = null;
        throw err;
      },
    );
  }
  return builtinIntegrationsSync;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname.startsWith("/v1/public/ws/") &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      return proxyPublicConversationWebSocket(request, env);
    }
    await ensureBuiltinIntegrations(env).catch((err) => {
      console.error(
        JSON.stringify({
          event: "builtin_integrations_sync_failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    });
    return app.fetch(request, env, ctx);
  },

  async queue(
    batch: MessageBatch<IngestQueueMessage>,
    env: Env,
  ): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processIngestJob(env, msg.body);
        msg.ack();
      } catch (e) {
        console.error("ingest_failed", e);
        msg.retry();
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (event.cron === "0 * * * *") {
      const shellJobs = await processEnterpriseShellQueue(env);
      if (shellJobs > 0) {
        console.log(JSON.stringify({ event: "enterprise_shell_ready", count: shellJobs }));
      }
      const idleClosed = await closeIdleAutomatedConversations(env);
      if (idleClosed.closed > 0) {
        console.log(JSON.stringify({ event: "visitor_idle_close", ...idleClosed }));
      }
      const { purgeDueOrgDeletions } = await import("./lib/account-deletion");
      const deletedOrgs = await purgeDueOrgDeletions(env);
      if (deletedOrgs > 0) {
        console.log(JSON.stringify({ event: "org_deletion_purge", count: deletedOrgs }));
      }
    }
    if (event.cron === "0 3 * * *") {
      const period = periodStartIso();
      await env.DB.prepare(
        `UPDATE usage_counters SET ai_credits_used = 0, messages_count = 0, setup_credits_used = 0, rag_meter_credits = 0, period_start = ?, updated_at = datetime('now')
         WHERE period_start != ?`,
      )
        .bind(period, period)
        .run();
      await env.DB.prepare(
        `DELETE FROM idempotency_keys WHERE expires_at < datetime('now')`,
      ).run();
      await env.DB.prepare(
        `DELETE FROM oauth_states WHERE expires_at < datetime('now')`,
      ).run();
      const purged = await purgeExpiredConversations(env.DB, env.CONVERSATION);
      console.log(JSON.stringify({ event: "log_purge", ...purged }));
    }
  },
};
