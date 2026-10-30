import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAdminRole } from "../lib/auth";
import { apiError, json } from "../lib/http";
import {
  loadBotWebConfig,
  replaceBotAllowedOrigins,
} from "../lib/bot-web-config";
import { invalidateBotCache } from "../lib/tenant-cache";

export function registerAdminWebRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/bots/:botId/web", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const botId = c.req.param("botId");
    const config = await loadBotWebConfig(c.env, auth.user.orgId!, botId);
    if (!config.ok) {
      if (config.error === "publishable_key_missing") {
        return apiError("publishable_key_missing", 503);
      }
      return apiError("not_found", 404);
    }

    const { publishableKey, ...rest } = config;
    return json({
      ...rest,
      publishableKey,
      publishableKeyPrefix: publishableKey.slice(0, 12),
    });
  });

  app.patch("/v1/admin/bots/:botId/web", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const botId = c.req.param("botId");
    const parsed = z
      .object({
        allowedOrigins: z.array(z.string()).max(64),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.user.orgId)
      .first();
    if (!bot) return apiError("not_found", 404);

    const result = await replaceBotAllowedOrigins(
      c.env,
      botId,
      auth.user.orgId!,
      parsed.data.allowedOrigins,
    );
    if (!result.ok) {
      if (result.error === "plan_origin_limit") {
        return apiError(
          "plan_origin_limit",
          403,
          undefined,
          "Tu plan no incluye sitios web permitidos para el widget.",
        );
      }
      return apiError(
        "origin_limit_exceeded",
        400,
        undefined,
        "Superaste el máximo de sitios permitidos en tu plan.",
      );
    }

    await invalidateBotCache(c.env, botId);

    const config = await loadBotWebConfig(c.env, auth.user.orgId!, botId);
    if (!config.ok) return apiError("not_found", 404);

    const { publishableKey, ...rest } = config;
    return json({
      ...rest,
      publishableKey,
      publishableKeyPrefix: publishableKey.slice(0, 12),
      ok: true,
    });
  });
}
