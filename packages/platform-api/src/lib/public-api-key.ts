import { authenticateApiKey } from "./api-key-auth";
import { apiError } from "./http";
import { isPublicOriginAllowed } from "./public-origin";
import { getBotConfig, type BotPublicConfig } from "./tenant-cache";
import type { ApiKeyAuth } from "../types";
import type { Context } from "hono";
import type { AppEnv } from "../types";

export function extractPublicApiKey(request: Request): string | null {
  const url = new URL(request.url);
  return (
    request.headers.get("X-Api-Key") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("key") ??
    url.searchParams.get("api_key") ??
    null
  );
}

export async function requirePublishableBot(
  c: Context<AppEnv>,
): Promise<
  | { ok: true; auth: ApiKeyAuth; bot: BotPublicConfig }
  | { ok: false; response: Response }
> {
  const token = extractPublicApiKey(c.req.raw);
  if (!token) return { ok: false, response: apiError("unauthorized", 401) };

  const auth = await authenticateApiKey(c.env, token);
  if (!auth || auth.kind !== "publishable" || !auth.botId) {
    return { ok: false, response: apiError("unauthorized", 401) };
  }

  const bot = await getBotConfig(c.env, auth.botId);
  if (!bot) return { ok: false, response: apiError("not_found", 404) };
  if (bot.orgStatus !== "active") {
    return { ok: false, response: apiError("org_inactive", 403) };
  }

  const origin = c.req.header("Origin") ?? "";
  if (origin && !isPublicOriginAllowed(c.env, bot.allowedOrigins, origin)) {
    return { ok: false, response: apiError("origin_not_allowed", 403) };
  }

  if (auth.orgId !== bot.orgId) {
    return { ok: false, response: apiError("unauthorized", 401) };
  }

  return { ok: true, auth, bot };
}
