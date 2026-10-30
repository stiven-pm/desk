import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { getBearerToken, verifySessionToken } from "../lib/auth";
import { canAccessLegacyRoles } from "@chatbot/domain";
import type { TenantUser } from "../types";
import { encryptSecret } from "../lib/crypto";
import { apiError, json, randomId } from "../lib/http";
import {
  buildOAuthAuthorizeUrl,
  configFromTokenResponse,
  connectorKeyForProvider,
  exchangeOAuthCode,
  oauthConfigured,
  type OAuthProviderId,
} from "../lib/oauth-providers";
import {
  materializeConnectorTools,
  persistConnectorTools,
} from "../lib/connectors";
import { invalidateBotCache } from "../lib/tenant-cache";
import { PLAN_LIMITS, planFromSlug } from "@chatbot/domain";

const PROVIDERS = new Set<OAuthProviderId>(["google", "hubspot", "shopify"]);

export function registerOAuthRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/oauth/:provider/start", async (c) => {
    const token =
      getBearerToken(c.req.raw) ?? c.req.query("session") ?? null;
    if (!token) return apiError("unauthorized", 401);
    const user = await verifySessionToken(token, c.env.JWT_SECRET);
    if (!user || user.scope !== "tenant" || !user.orgId) {
      return apiError("unauthorized", 401);
    }
    const row = await c.env.DB.prepare(
      `SELECT role, capabilities_json FROM memberships WHERE org_id = ? AND user_id = ?`,
    )
      .bind(user.orgId, user.id)
      .first<{ role: string; capabilities_json: string | null }>();
    if (
      !row ||
      !canAccessLegacyRoles(row.role, row.capabilities_json, [
        "owner",
        "admin",
        "developer",
      ])
    ) {
      return apiError("forbidden", 403);
    }
    const auth = { user: user as TenantUser };

    const provider = c.req.param("provider") as OAuthProviderId;
    if (!PROVIDERS.has(provider)) return apiError("invalid_provider", 400);
    if (!oauthConfigured(c.env, provider)) {
      return apiError("oauth_not_configured", 503);
    }

    const botId = c.req.query("botId");
    const returnUrl = c.req.query("returnUrl") ?? c.env.APP_URL ?? "/";
    const shop = c.req.query("shop") ?? undefined;
    if (!botId) return apiError("invalid_body", 400);

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.user.orgId)
      .first();
    if (!bot) return apiError("not_found", 404);

    const org = await c.env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();
    const limits = PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];
    if (limits.maxConnectorsPerBot <= 0) {
      return apiError("plan_integration_limit", 403);
    }

    const stateId = randomId();
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO oauth_states (id, org_id, bot_id, provider, connector_key, return_url, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        stateId,
        auth.user.orgId,
        botId,
        provider,
        connectorKeyForProvider(provider),
        returnUrl,
        expires,
      )
      .run();

    const apiBase = (c.env.PLATFORM_API_URL ?? new URL(c.req.url).origin).replace(
      /\/$/,
      "",
    );
    const redirectUri = `${apiBase}/v1/admin/oauth/${provider}/callback`;
    const url = buildOAuthAuthorizeUrl(c.env, provider, stateId, redirectUri, {
      shop,
    });
    return c.redirect(url, 302);
  });

  app.get("/v1/admin/oauth/:provider/callback", async (c) => {
    const provider = c.req.param("provider") as OAuthProviderId;
    if (!PROVIDERS.has(provider)) return apiError("invalid_provider", 400);

    const code = c.req.query("code");
    const stateId = c.req.query("state");
    const shop = c.req.query("shop") ?? undefined;
    if (!code || !stateId) return apiError("invalid_callback", 400);

    const state = await c.env.DB.prepare(
      `SELECT org_id, bot_id, connector_key, return_url FROM oauth_states
       WHERE id = ? AND provider = ? AND expires_at > datetime('now')`,
    )
      .bind(stateId, provider)
      .first<{
        org_id: string;
        bot_id: string;
        connector_key: string;
        return_url: string;
      }>();
    if (!state) return apiError("invalid_state", 400);

    await c.env.DB.prepare(`DELETE FROM oauth_states WHERE id = ?`)
      .bind(stateId)
      .run();

    const encKey = c.env.ENCRYPTION_KEY?.trim();
    if (!encKey) return apiError("encryption_not_configured", 503);

    const apiBase = (c.env.PLATFORM_API_URL ?? new URL(c.req.url).origin).replace(
      /\/$/,
      "",
    );
    const redirectUri = `${apiBase}/v1/admin/oauth/${provider}/callback`;

    let tokens: Record<string, unknown>;
    try {
      tokens = await exchangeOAuthCode(c.env, provider, code, redirectUri, {
        shop,
      });
    } catch {
      return apiError("token_exchange_failed", 502);
    }

    const config = configFromTokenResponse(provider, tokens);
    const configEnc = await encryptSecret(JSON.stringify(config), encKey);

    const existing = await c.env.DB.prepare(
      `SELECT id FROM bot_connectors WHERE bot_id = ? AND connector_key = ?`,
    )
      .bind(state.bot_id, state.connector_key)
      .first<{ id: string }>();

    const connectorId = existing?.id ?? randomId();
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE bot_connectors SET config_enc = ?, enabled = 1, status = 'connected', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(configEnc, connectorId)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO bot_connectors (id, bot_id, connector_key, config_enc, enabled, status)
         VALUES (?, ?, ?, ?, 1, 'connected')`,
      )
        .bind(connectorId, state.bot_id, state.connector_key, configEnc)
        .run();
    }

    const defs = materializeConnectorTools(state.connector_key, {
      ...config,
      accessToken: config.accessToken,
      apiKey: config.accessToken,
    });
    await persistConnectorTools(
      c.env.DB,
      state.bot_id,
      connectorId,
      defs,
      encKey,
    );
    await invalidateBotCache(c.env, state.bot_id);

    const back = new URL(
      state.return_url || c.env.APP_URL || "https://desk.rekov.co",
    );
    back.searchParams.set("oauth", "ok");
    back.searchParams.set("connector", state.connector_key);
    return c.redirect(back.toString(), 302);
  });

  app.get("/v1/admin/oauth/status", async (c) => {
    return json({
      google: oauthConfigured(c.env, "google"),
      hubspot: oauthConfigured(c.env, "hubspot"),
      shopify: oauthConfigured(c.env, "shopify"),
    });
  });
}
