import { PLAN_LIMITS, planFromSlug } from "@chatbot/domain";
import type { Env } from "../types";
import { filterTenantWidgetOrigins } from "./assistant-display";
import { getPublishableKeyPlain } from "./publishable-key";

export function normalizeAllowedOrigin(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function hostedChatUrl(env: Env, orgSlug: string): string {
  const base = (env.APP_URL ?? "https://desk.rekov.co").replace(/\/$/, "");
  return `${base}/chat/${encodeURIComponent(orgSlug)}`;
}

/** Tienda pública Desk: catálogo + carrito + asistente (misma base que el slug del tenant). */
export function hostedStorefrontUrl(env: Env, orgSlug: string): string {
  const base = (env.APP_URL ?? "https://desk.rekov.co").replace(/\/$/, "");
  return `${base}/${encodeURIComponent(orgSlug)}`;
}

export function widgetCdnBase(env: Env): string {
  return (env.PLATFORM_API_URL ?? "https://api-desk.rekov.co").replace(/\/$/, "");
}

export function buildWidgetEmbedSnippet(opts: {
  apiUrl: string;
  publishableKey: string;
  botId: string;
  chatUrl: string;
  label?: string;
}): string {
  const label = opts.label ?? "Chat";
  return `<script src="${opts.apiUrl}/cdn/desk-widget.js" async></script>
<script>
  DeskWidget.mount({
    apiUrl: "${opts.apiUrl}",
    publishableKey: "${opts.publishableKey}",
    botId: "${opts.botId}",
    chatUrl: "${opts.chatUrl}",
    label: "${label.replace(/"/g, '\\"')}",
  });
</script>`;
}

export async function listBotAllowedOrigins(
  env: Env,
  botId: string,
): Promise<string[]> {
  const rows = await env.DB.prepare(
    `SELECT origin FROM bot_allowed_origins WHERE bot_id = ? ORDER BY origin`,
  )
    .bind(botId)
    .all<{ origin: string }>();
  return (rows.results ?? []).map((r) => r.origin);
}

export async function replaceBotAllowedOrigins(
  env: Env,
  botId: string,
  orgId: string,
  rawOrigins: string[],
): Promise<{ ok: true; allowedOrigins: string[] } | { ok: false; error: string }> {
  const org = await env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ plan_slug: string }>();
  const limits = PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];
  const max = limits.maxOriginsPerBot;

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawOrigins) {
    const o = normalizeAllowedOrigin(raw);
    if (!o) continue;
    if (seen.has(o)) continue;
    seen.add(o);
    normalized.push(o);
  }

  if (max <= 0) {
    return { ok: false, error: "plan_origin_limit" };
  }
  if (normalized.length > max) {
    return { ok: false, error: "origin_limit_exceeded" };
  }

  const stmts = [
    env.DB.prepare(`DELETE FROM bot_allowed_origins WHERE bot_id = ?`).bind(
      botId,
    ),
    ...normalized.map((origin) =>
      env.DB.prepare(
        `INSERT INTO bot_allowed_origins (bot_id, origin) VALUES (?, ?)`,
      ).bind(botId, origin),
    ),
  ];
  await env.DB.batch(stmts);

  const appUrl = env.APP_URL;
  const display = filterTenantWidgetOrigins(normalized, appUrl);
  return { ok: true, allowedOrigins: display };
}

export async function loadBotWebConfig(
  env: Env,
  orgId: string,
  botId: string,
): Promise<
  | {
      ok: true;
      orgSlug: string;
      chatUrl: string;
      storefrontUrl: string;
      publishableKey: string;
      allowedOrigins: string[];
      maxOrigins: number;
      apiUrl: string;
      widgetScriptUrl: string;
      hostScriptUrl: string;
      embedSnippet: string;
    }
  | { ok: false; error: "not_found" | "publishable_key_missing" }
> {
  const row = await env.DB.prepare(
    `SELECT b.id, o.slug AS org_slug, o.plan_slug
     FROM bots b
     JOIN orgs o ON o.id = b.org_id
     WHERE b.id = ? AND b.org_id = ?`,
  )
    .bind(botId, orgId)
    .first<{ id: string; org_slug: string; plan_slug: string }>();
  if (!row) return { ok: false, error: "not_found" };

  let publishableKey = await getPublishableKeyPlain(env, botId);
  if (!publishableKey) return { ok: false, error: "publishable_key_missing" };

  const limits = PLAN_LIMITS[planFromSlug(row.plan_slug)];
  const origins = filterTenantWidgetOrigins(
    await listBotAllowedOrigins(env, botId),
    env.APP_URL,
  );
  const apiUrl = widgetCdnBase(env);
  const chatUrl = hostedChatUrl(env, row.org_slug);
  const storefrontUrl = hostedStorefrontUrl(env, row.org_slug);

  return {
    ok: true,
    orgSlug: row.org_slug,
    chatUrl,
    storefrontUrl,
    publishableKey,
    allowedOrigins: origins,
    maxOrigins: limits.maxOriginsPerBot,
    apiUrl,
    widgetScriptUrl: `${apiUrl}/cdn/desk-widget.js`,
    hostScriptUrl: `${apiUrl}/cdn/desk-host.js`,
    embedSnippet: buildWidgetEmbedSnippet({
      apiUrl,
      publishableKey,
      botId,
      chatUrl,
    }),
  };
}
