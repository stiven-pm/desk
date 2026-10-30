import type { Env } from "../types";

export interface BotPublicConfig {
  botId: string;
  orgId: string;
  name: string;
  allowedOrigins: string[];
  model: string;
  systemPrompt: string;
  orgStatus: string;
  planSlug: string;
  themeCssUrl: string | null;
  hostComponents: string[];
}

export async function getBotConfig(
  env: Env,
  botId: string,
): Promise<BotPublicConfig | null> {
  const cacheKey = `bot:${botId}`;
  const cached = await env.TENANT_CACHE.get(cacheKey, "json");
  if (cached) return cached as BotPublicConfig;

  const bot = await env.DB.prepare(
    `SELECT b.id, b.org_id, b.name, b.model, b.system_prompt,
            b.theme_css_url, b.host_components_json,
            o.status as org_status, o.plan_slug
     FROM bots b JOIN orgs o ON o.id = b.org_id WHERE b.id = ?`,
  )
    .bind(botId)
    .first<{
      id: string;
      org_id: string;
      name: string;
      model: string;
      system_prompt: string;
      theme_css_url: string | null;
      host_components_json: string | null;
      org_status: string;
      plan_slug: string;
    }>();
  if (!bot) return null;

  const origins = await env.DB.prepare(
    `SELECT origin FROM bot_allowed_origins WHERE bot_id = ?`,
  )
    .bind(botId)
    .all<{ origin: string }>();

  let hostComponents: string[] = [];
  if (bot.host_components_json) {
    try {
      const parsed = JSON.parse(bot.host_components_json) as string[];
      if (Array.isArray(parsed)) hostComponents = parsed.slice(0, 32);
    } catch {
      hostComponents = [];
    }
  }

  const config: BotPublicConfig = {
    botId: bot.id,
    orgId: bot.org_id,
    name: bot.name,
    model: bot.model,
    systemPrompt: bot.system_prompt,
    allowedOrigins: origins.results.map((r) => r.origin),
    orgStatus: bot.org_status,
    planSlug: bot.plan_slug,
    themeCssUrl: bot.theme_css_url,
    hostComponents,
  };

  await env.TENANT_CACHE.put(cacheKey, JSON.stringify(config), {
    expirationTtl: 120,
  });
  return config;
}

export async function invalidateBotCache(
  env: Env,
  botId: string,
): Promise<void> {
  await env.TENANT_CACHE.delete(`bot:${botId}`);
}
