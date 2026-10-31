import type { Env } from "../types";
import { getPublishableKeyPlain } from "./publishable-key";
import { widgetCdnBase } from "./bot-web-config";

export type PublicChatBootstrap = {
  orgSlug: string;
  orgName: string;
  botId: string;
  botName: string;
  publishableKey: string;
  themeCssUrl: string | null;
  welcomeMessage: string | null;
  idleReplyMessage: string | null;
  apiUrl: string;
  turnstileSiteKey?: string | null;
};

export async function loadPublicChatByOrgSlug(
  env: Env,
  slug: string,
): Promise<
  | { ok: true; data: PublicChatBootstrap }
  | { ok: false; error: "not_found" | "inactive" | "publishable_key_missing" }
> {
  const row = await env.DB.prepare(
    `SELECT o.id AS org_id, o.name AS org_name, o.status, o.slug,
            b.id AS bot_id, b.name AS bot_name, b.theme_css_url, b.welcome_message,
            b.idle_reply_message
     FROM orgs o
     JOIN bots b ON b.org_id = o.id
     WHERE o.slug = ?
     ORDER BY b.created_at ASC
     LIMIT 1`,
  )
    .bind(slug)
    .first<{
      org_id: string;
      org_name: string;
      status: string;
      slug: string;
      bot_id: string;
      bot_name: string;
      theme_css_url: string | null;
      welcome_message: string | null;
      idle_reply_message: string | null;
    }>();

  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "active") return { ok: false, error: "inactive" };

  const publishableKey = await getPublishableKeyPlain(env, row.bot_id);
  if (!publishableKey) return { ok: false, error: "publishable_key_missing" };

  return {
    ok: true,
    data: {
      orgSlug: row.slug,
      orgName: row.org_name,
      botId: row.bot_id,
      botName: row.bot_name,
      publishableKey,
      themeCssUrl: row.theme_css_url,
      welcomeMessage: row.welcome_message,
      idleReplyMessage: row.idle_reply_message,
      apiUrl: widgetCdnBase(env),
    },
  };
}
