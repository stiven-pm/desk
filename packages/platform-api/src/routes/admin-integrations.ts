import type { Hono } from "hono";
import {
  assertPublicHttpUrl,
  createHttpToolSchema,
  parseCurlCommand,
  patchMcpServerSchema,
  planAllowsIntegrations,
  planFromSlug,
  PLAN_LIMITS,
  updateHttpToolSchema,
  upsertConnectorSchema,
  upsertMcpServerSchema,
  upsertOpenApiConfigSchema,
  upsertOrgCommerceSettingsSchema,
  upsertOrgWebhookSchema,
} from "@chatbot/domain";
import type { AppEnv } from "../types";
import { requireAdminRole, requireUser } from "../lib/auth";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { apiError, json, randomId } from "../lib/http";
import { invalidateBotCache } from "../lib/tenant-cache";
import { syncOpenApiTools } from "../lib/integration-openapi";
import {
  materializeConnectorTools,
  persistConnectorTools,
} from "../lib/connectors";
import { enrichConnectorConfig } from "../lib/connector-enrich";
import { listGoogleSpreadsheets } from "../lib/google-drive";

async function assertBot(
  db: D1Database,
  botId: string,
  orgId: string,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT id FROM bots WHERE id = ? AND org_id = ?`)
    .bind(botId, orgId)
    .first();
  return Boolean(row);
}

function requireEncryption(env: { ENCRYPTION_KEY?: string }): string | null {
  const k = env.ENCRYPTION_KEY?.trim();
  return k || null;
}

export function registerAdminIntegrationRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/integrations/summary", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const botId = c.req.query("botId");
    if (!botId) return apiError("invalid_body", 400);
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const limits = await planLimits(c.env, auth.user.orgId!);
    const [openapi, tools, mcp, connectors, webhooks, orgRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, base_url, enabled, updated_at FROM bot_openapi_configs WHERE bot_id = ?`,
      )
        .bind(botId)
        .all(),
      c.env.DB.prepare(
        `SELECT id, name, description, method, path, base_url, source, enabled FROM bot_http_tools WHERE bot_id = ?`,
      )
        .bind(botId)
        .all(),
      c.env.DB.prepare(
        `SELECT id, name, server_url, enabled FROM bot_mcp_servers WHERE bot_id = ?`,
      )
        .bind(botId)
        .all(),
      c.env.DB.prepare(
        `SELECT id, connector_key, status, enabled, updated_at FROM bot_connectors WHERE bot_id = ?`,
      )
        .bind(botId)
        .all(),
      c.env.DB.prepare(
        `SELECT id, url, events_json, enabled FROM org_event_webhooks WHERE org_id = ?`,
      )
        .bind(auth.user.orgId)
        .all(),
      c.env.DB.prepare(
        `SELECT commerce_payload_keys_json FROM orgs WHERE id = ?`,
      )
        .bind(auth.user.orgId)
        .first<{ commerce_payload_keys_json: string | null }>(),
    ]);
    let commercePayloadKeys: string[] = [];
    if (orgRow?.commerce_payload_keys_json) {
      try {
        const parsed = JSON.parse(orgRow.commerce_payload_keys_json) as unknown;
        if (Array.isArray(parsed)) {
          commercePayloadKeys = parsed.filter((k): k is string => typeof k === "string");
        }
      } catch {
        commercePayloadKeys = [];
      }
    }
    const { getMcpCatalogSyncSummary } = await import("../lib/mcp-catalog-sync");
    const mcpCatalog = await getMcpCatalogSyncSummary(c.env.DB, botId);

    return json({
      limits,
      integrationsEnabled: planAllowsIntegrations(limits),
      openapi: openapi.results,
      httpTools: tools.results,
      mcpServers: mcp.results,
      mcpCatalog,
      connectors: connectors.results,
      webhooks: webhooks.results,
      commercePayloadKeys,
    });
  });

  app.get("/v1/admin/bots/:botId/connectors/google_sheets/spreadsheets", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const limits = await planLimits(c.env, auth.user.orgId!);
    if (limits.maxConnectorsPerBot <= 0) return apiError("plan_integration_limit", 403);

    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const row = await c.env.DB.prepare(
      `SELECT config_enc FROM bot_connectors WHERE bot_id = ? AND connector_key = 'google_sheets'`,
    )
      .bind(botId)
      .first<{ config_enc: string }>();
    if (!row?.config_enc) return apiError("connector_not_connected", 404);

    const plain = await decryptSecret(row.config_enc, encKey);
    if (!plain) return apiError("connector_not_connected", 404);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(plain) as Record<string, unknown>;
    } catch {
      return apiError("connector_config_invalid", 500);
    }
    const token = String(config.accessToken ?? config.apiKey ?? "");
    if (!token) return apiError("connector_not_connected", 404);

    try {
      const files = await listGoogleSpreadsheets(token);
      return json({
        spreadsheets: files,
        selectedSpreadsheetId: config.spreadsheetId ?? null,
        range: config.range ?? "A1:Z200",
      });
    } catch {
      return apiError("drive_list_failed", 502);
    }
  });

  app.put("/v1/admin/bots/:botId/openapi", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const org = await c.env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();
    const limits = PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];
    if (limits.maxHttpToolsPerBot <= 0) return apiError("plan_integration_limit", 403);

    const parsed = upsertOpenApiConfigSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const specStr =
      typeof parsed.data.spec === "string"
        ? parsed.data.spec
        : JSON.stringify(parsed.data.spec);

    let authSecretEnc: string | null = null;
    if (parsed.data.authSecret) {
      authSecretEnc = await encryptSecret(parsed.data.authSecret, encKey);
    }

    const existing = await c.env.DB.prepare(
      `SELECT id FROM bot_openapi_configs WHERE bot_id = ? LIMIT 1`,
    )
      .bind(botId)
      .first<{ id: string }>();

    const configId = existing?.id ?? randomId();
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE bot_openapi_configs SET base_url = ?, spec_json = ?, auth_type = ?, auth_header_name = ?, auth_secret_enc = COALESCE(?, auth_secret_enc), enabled = COALESCE(?, enabled), updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(
          parsed.data.baseUrl,
          specStr,
          parsed.data.authType,
          parsed.data.authHeaderName ?? null,
          authSecretEnc,
          parsed.data.enabled === undefined ? 1 : parsed.data.enabled ? 1 : 0,
          configId,
        )
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO bot_openapi_configs (id, bot_id, base_url, spec_json, auth_type, auth_header_name, auth_secret_enc, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          configId,
          botId,
          parsed.data.baseUrl,
          specStr,
          parsed.data.authType,
          parsed.data.authHeaderName ?? null,
          authSecretEnc,
          parsed.data.enabled === false ? 0 : 1,
        )
        .run();
    }

    const sync = await syncOpenApiTools(c.env.DB, botId, configId, specStr);
    await invalidateBotCache(c.env, botId);
    return json({ configId, toolsSynced: sync.count, error: sync.error });
  });

  app.post("/v1/admin/bots/:botId/http-tools", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const limits = await planLimits(c.env, auth.user.orgId!);
    if (limits.maxHttpToolsPerBot <= 0) return apiError("plan_integration_limit", 403);

    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM bot_http_tools WHERE bot_id = ?`,
    )
      .bind(botId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= limits.maxHttpToolsPerBot) {
      return apiError("plan_tool_limit", 403);
    }

    const parsed = createHttpToolSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);
    if (!parsed.data.baseUrl) return apiError("base_url_required", 400);

    const id = randomId();
    await c.env.DB.prepare(
      `INSERT INTO bot_http_tools (id, bot_id, name, description, method, path, base_url, parameters_json, source, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
    )
      .bind(
        id,
        botId,
        parsed.data.name,
        parsed.data.description,
        parsed.data.method,
        parsed.data.path,
        parsed.data.baseUrl,
        JSON.stringify(parsed.data.parameters),
        parsed.data.enabled === false ? 0 : 1,
      )
      .run();
    await invalidateBotCache(c.env, botId);
    return json({ id });
  });

  app.post("/v1/admin/bots/:botId/http-tools/import-curl", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const botId = c.req.param("botId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }

    const limits = await planLimits(c.env, auth.user.orgId!);
    if (limits.maxHttpToolsPerBot <= 0) return apiError("plan_integration_limit", 403);

    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM bot_http_tools WHERE bot_id = ?`,
    )
      .bind(botId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= limits.maxHttpToolsPerBot) {
      return apiError("plan_tool_limit", 403);
    }

    const body = (await c.req.json()) as {
      curl?: string;
      name?: string;
      description?: string;
    };
    const parsedCurl = parseCurlCommand(String(body.curl ?? ""));
    if (!parsedCurl) return apiError("invalid_curl", 400);

    try {
      assertPublicHttpUrl(parsedCurl.url);
    } catch {
      return apiError("url_host_blocked", 400);
    }

    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const slug =
      body.name?.trim() ||
      `conn_${parsedCurl.method.toLowerCase()}_${parsedCurl.path
        .replace(/[^a-z0-9]+/gi, "_")
        .slice(0, 24)}`;
    const toolName = slug.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
    if (!/^[a-zA-Z]/.test(toolName)) {
      return apiError("invalid_tool_name", 400);
    }

    let authSecretEnc: string | null = null;
    if (parsedCurl.authSecret) {
      authSecretEnc = await encryptSecret(parsedCurl.authSecret, encKey);
    }

    const headersJson =
      Object.keys(parsedCurl.headers).length > 0
        ? JSON.stringify(parsedCurl.headers)
        : null;

    const id = randomId();
    await c.env.DB.prepare(
      `INSERT INTO bot_http_tools (id, bot_id, name, description, method, path, base_url,
        auth_type, auth_header_name, auth_secret_enc, headers_json, parameters_json, source, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'manual', 1)`,
    )
      .bind(
        id,
        botId,
        toolName,
        body.description?.slice(0, 2000) ??
          `Importado desde cURL (${parsedCurl.method} ${parsedCurl.path})`,
        parsedCurl.method,
        parsedCurl.path,
        parsedCurl.baseUrl,
        parsedCurl.authType,
        parsedCurl.authHeaderName ?? null,
        authSecretEnc,
        headersJson,
      )
      .run();

    await invalidateBotCache(c.env, botId);
    return json({
      id,
      name: toolName,
      baseUrl: parsedCurl.baseUrl,
      path: parsedCurl.path,
      authStored: Boolean(authSecretEnc),
    });
  });

  app.patch("/v1/admin/bots/:botId/http-tools/:toolId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const toolId = c.req.param("toolId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }

    const existing = await c.env.DB.prepare(
      `SELECT t.id, t.source, t.name FROM bot_http_tools t
       JOIN bots b ON b.id = t.bot_id
       WHERE t.id = ? AND t.bot_id = ? AND b.org_id = ?`,
    )
      .bind(toolId, botId, auth.user.orgId)
      .first<{ id: string; source: string; name: string }>();
    if (!existing) return apiError("not_found", 404);
    if (existing.source !== "manual" || existing.name.startsWith("conn_")) {
      return apiError("tool_not_editable", 403);
    }

    const parsed = updateHttpToolSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.name !== undefined) {
      fields.push("name = ?");
      values.push(parsed.data.name);
    }
    if (parsed.data.description !== undefined) {
      fields.push("description = ?");
      values.push(parsed.data.description);
    }
    if (parsed.data.method !== undefined) {
      fields.push("method = ?");
      values.push(parsed.data.method);
    }
    if (parsed.data.path !== undefined) {
      fields.push("path = ?");
      values.push(parsed.data.path);
    }
    if (parsed.data.baseUrl !== undefined) {
      fields.push("base_url = ?");
      values.push(parsed.data.baseUrl);
    }
    if (parsed.data.parameters !== undefined) {
      fields.push("parameters_json = ?");
      values.push(JSON.stringify(parsed.data.parameters));
    }
    if (parsed.data.enabled !== undefined) {
      fields.push("enabled = ?");
      values.push(parsed.data.enabled ? 1 : 0);
    }
    if (fields.length === 0) return apiError("invalid_body", 400);

    await c.env.DB.prepare(
      `UPDATE bot_http_tools SET ${fields.join(", ")} WHERE id = ? AND bot_id = ?`,
    )
      .bind(...values, toolId, botId)
      .run();
    await invalidateBotCache(c.env, botId);
    return json({ id: toolId });
  });

  app.delete("/v1/admin/bots/:botId/http-tools/:toolId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const toolId = c.req.param("toolId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }

    const existing = await c.env.DB.prepare(
      `SELECT t.id, t.source, t.name FROM bot_http_tools t
       JOIN bots b ON b.id = t.bot_id
       WHERE t.id = ? AND t.bot_id = ? AND b.org_id = ?`,
    )
      .bind(toolId, botId, auth.user.orgId)
      .first<{ id: string; source: string; name: string }>();
    if (!existing) return apiError("not_found", 404);
    if (existing.source !== "manual" || existing.name.startsWith("conn_")) {
      return apiError("tool_not_editable", 403);
    }

    await c.env.DB.prepare(`DELETE FROM bot_http_tools WHERE id = ? AND bot_id = ?`)
      .bind(toolId, botId)
      .run();
    await invalidateBotCache(c.env, botId);
    return json({ ok: true });
  });

  app.put("/v1/admin/bots/:botId/mcp-servers", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const limits = await planLimits(c.env, auth.user.orgId!);
    if (limits.maxMcpServersPerBot <= 0) return apiError("plan_integration_limit", 403);

    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const parsed = upsertMcpServerSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const headersEnc = parsed.data.headers
      ? await encryptSecret(JSON.stringify(parsed.data.headers), encKey)
      : null;

    const existing = await c.env.DB.prepare(
      `SELECT id FROM bot_mcp_servers WHERE bot_id = ? AND name = ?`,
    )
      .bind(botId, parsed.data.name)
      .first<{ id: string }>();

    const id = existing?.id ?? randomId();
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE bot_mcp_servers SET server_url = ?, headers_enc = COALESCE(?, headers_enc), enabled = COALESCE(?, enabled) WHERE id = ?`,
      )
        .bind(
          parsed.data.serverUrl,
          headersEnc,
          parsed.data.enabled === undefined ? 1 : parsed.data.enabled ? 1 : 0,
          id,
        )
        .run();
    } else {
      const mcpCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as n FROM bot_mcp_servers WHERE bot_id = ?`,
      )
        .bind(botId)
        .first<{ n: number }>();
      if ((mcpCount?.n ?? 0) >= limits.maxMcpServersPerBot) {
        return apiError("plan_mcp_limit", 403);
      }
      await c.env.DB.prepare(
        `INSERT INTO bot_mcp_servers (id, bot_id, name, server_url, headers_enc, enabled)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          botId,
          parsed.data.name,
          parsed.data.serverUrl,
          headersEnc,
          parsed.data.enabled === false ? 0 : 1,
        )
        .run();
    }
    await invalidateBotCache(c.env, botId);
    const { syncMcpServerAfterUpsert } = await import("../lib/mcp-catalog-sync");
    try {
      await syncMcpServerAfterUpsert(c.env, botId, id, encKey);
    } catch {
      /* catalog sync best-effort */
    }
    return json({ id });
  });

  app.post("/v1/admin/bots/:botId/mcp-servers/:serverId/refresh-catalog", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const serverId = c.req.param("serverId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);
    const { refreshMcpServerCatalog } = await import("../lib/mcp-catalog-sync");
    const result = await refreshMcpServerCatalog(c.env, {
      botId,
      serverId,
      encryptionKey: encKey,
    });
    if (!result.ok) return apiError(result.error, 400);
    return json({ ok: true, toolCount: result.count });
  });

  app.patch("/v1/admin/bots/:botId/mcp-servers/:serverId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const serverId = c.req.param("serverId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }

    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const row = await c.env.DB.prepare(
      `SELECT m.id FROM bot_mcp_servers m
       JOIN bots b ON b.id = m.bot_id
       WHERE m.id = ? AND m.bot_id = ? AND b.org_id = ?`,
    )
      .bind(serverId, botId, auth.user.orgId)
      .first<{ id: string }>();
    if (!row) return apiError("not_found", 404);

    const parsed = patchMcpServerSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const headersEnc =
      parsed.data.headers !== undefined
        ? await encryptSecret(JSON.stringify(parsed.data.headers), encKey)
        : undefined;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.name !== undefined) {
      fields.push("name = ?");
      values.push(parsed.data.name);
    }
    if (parsed.data.serverUrl !== undefined) {
      fields.push("server_url = ?");
      values.push(parsed.data.serverUrl);
    }
    if (headersEnc !== undefined) {
      fields.push("headers_enc = ?");
      values.push(headersEnc);
    }
    if (parsed.data.enabled !== undefined) {
      fields.push("enabled = ?");
      values.push(parsed.data.enabled ? 1 : 0);
    }

    await c.env.DB.prepare(
      `UPDATE bot_mcp_servers SET ${fields.join(", ")} WHERE id = ? AND bot_id = ?`,
    )
      .bind(...values, serverId, botId)
      .run();
    await invalidateBotCache(c.env, botId);
    return json({ id: serverId });
  });

  app.delete("/v1/admin/bots/:botId/mcp-servers/:serverId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const serverId = c.req.param("serverId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }

    const row = await c.env.DB.prepare(
      `SELECT m.id FROM bot_mcp_servers m
       JOIN bots b ON b.id = m.bot_id
       WHERE m.id = ? AND m.bot_id = ? AND b.org_id = ?`,
    )
      .bind(serverId, botId, auth.user.orgId)
      .first();
    if (!row) return apiError("not_found", 404);

    await c.env.DB.prepare(`DELETE FROM bot_mcp_servers WHERE id = ? AND bot_id = ?`)
      .bind(serverId, botId)
      .run();
    await invalidateBotCache(c.env, botId);
    return json({ ok: true });
  });

  app.put("/v1/admin/bots/:botId/connectors", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
      return apiError("not_found", 404);
    }
    const limits = await planLimits(c.env, auth.user.orgId!);
    if (limits.maxConnectorsPerBot <= 0) return apiError("plan_integration_limit", 403);

    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const parsed = upsertConnectorSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const existing = await c.env.DB.prepare(
      `SELECT id, config_enc FROM bot_connectors WHERE bot_id = ? AND connector_key = ?`,
    )
      .bind(botId, parsed.data.connectorKey)
      .first<{ id: string; config_enc: string }>();

    let mergedConfig = parsed.data.config;
    if (existing?.config_enc) {
      const prev = await decryptSecret(existing.config_enc, encKey);
      if (prev) {
        try {
          mergedConfig = {
            ...(JSON.parse(prev) as Record<string, unknown>),
            ...parsed.data.config,
          };
        } catch {
          mergedConfig = parsed.data.config;
        }
      }
    }
    try {
      mergedConfig = await enrichConnectorConfig(
        parsed.data.connectorKey,
        mergedConfig,
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : "connector_config_invalid";
      return apiError(code, 400);
    }

    const configEnc = await encryptSecret(JSON.stringify(mergedConfig), encKey);

    const id = existing?.id ?? randomId();
    if (!existing) {
      const n = await c.env.DB.prepare(
        `SELECT COUNT(*) as c FROM bot_connectors WHERE bot_id = ?`,
      )
        .bind(botId)
        .first<{ c: number }>();
      if ((n?.c ?? 0) >= limits.maxConnectorsPerBot) {
        return apiError("plan_connector_limit", 403);
      }
    }

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE bot_connectors SET config_enc = ?, enabled = ?, status = 'connected', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(
          configEnc,
          parsed.data.enabled === false ? 0 : 1,
          id,
        )
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO bot_connectors (id, bot_id, connector_key, config_enc, enabled, status)
         VALUES (?, ?, ?, ?, ?, 'connected')`,
      )
        .bind(
          id,
          botId,
          parsed.data.connectorKey,
          configEnc,
          parsed.data.enabled === false ? 0 : 1,
        )
        .run();
    }

    const defs = materializeConnectorTools(
      parsed.data.connectorKey,
      mergedConfig,
    );
    await persistConnectorTools(c.env.DB, botId, id, defs, encKey);
    await invalidateBotCache(c.env, botId);
    return json({ id, tools: defs.length });
  });

  app.get("/v1/admin/commerce-harness", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const row = await c.env.DB.prepare(
      `SELECT mode, manifest_json FROM org_commerce_config WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ mode: string; manifest_json: string | null }>();

    return json({
      mode: row?.mode ?? "order_only",
      manifest: row?.manifest_json ? JSON.parse(row.manifest_json) : {},
    });
  });

  app.patch("/v1/admin/commerce-harness", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const body = (await c.req.json()) as {
      mode?: "order_only" | "checkout_link";
      manifest?: Record<string, unknown>;
    };
    const mode = body.mode === "checkout_link" ? "checkout_link" : "order_only";
    let manifestJson: string | null = null;
    if (body.manifest) {
      const { commerceManifestSchema, parseCommerceManifest } = await import(
        "@chatbot/domain"
      );
      const parsed = commerceManifestSchema
        .partial()
        .safeParse(body.manifest);
      if (!parsed.success) return apiError("invalid_body", 400);
      const prev = await c.env.DB.prepare(
        `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
      )
        .bind(auth.user.orgId)
        .first<{ manifest_json: string | null }>();
      const merged = {
        ...parseCommerceManifest(prev?.manifest_json),
        ...parsed.data,
        paymentInstructions: {
          ...parseCommerceManifest(prev?.manifest_json).paymentInstructions,
          ...parsed.data.paymentInstructions,
        },
      };
      manifestJson = JSON.stringify(merged);
    }

    await c.env.DB.prepare(
      `INSERT INTO org_commerce_config (org_id, mode, manifest_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(org_id) DO UPDATE SET
         mode = excluded.mode,
         manifest_json = excluded.manifest_json,
         updated_at = datetime('now')`,
    )
      .bind(auth.user.orgId, mode, manifestJson)
      .run();

    return json({ ok: true, mode });
  });

  app.patch("/v1/admin/org-commerce-settings", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const parsed = upsertOrgCommerceSettingsSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const keys = parsed.data.commercePayloadKeys ?? [];
    await c.env.DB.prepare(
      `UPDATE orgs SET commerce_payload_keys_json = ? WHERE id = ?`,
    )
      .bind(keys.length > 0 ? JSON.stringify(keys) : null, auth.user.orgId)
      .run();

    return json({ commercePayloadKeys: keys });
  });

  app.put("/v1/admin/org-webhooks", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;
    const limits = await planLimits(c.env, auth.user.orgId!);
    if (limits.maxOrgWebhooks <= 0) return apiError("plan_integration_limit", 403);

    const encKey = requireEncryption(c.env);
    if (!encKey) return apiError("encryption_not_configured", 503);

    const parsed = upsertOrgWebhookSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const secretEnc = parsed.data.secret
      ? await encryptSecret(parsed.data.secret, encKey)
      : null;

    const id = randomId();
    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM org_event_webhooks WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= limits.maxOrgWebhooks) {
      return apiError("plan_webhook_limit", 403);
    }

    await c.env.DB.prepare(
      `INSERT INTO org_event_webhooks (id, org_id, url, secret_enc, events_json, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        auth.user.orgId,
        parsed.data.url,
        secretEnc,
        JSON.stringify(parsed.data.events),
        parsed.data.enabled === false ? 0 : 1,
      )
      .run();
    return json({ id });
  });

  app.delete("/v1/admin/org-webhooks/:id", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;
    await c.env.DB.prepare(
      `DELETE FROM org_event_webhooks WHERE id = ? AND org_id = ?`,
    )
      .bind(c.req.param("id"), auth.user.orgId)
      .run();
    return json({ ok: true });
  });
}

async function planLimits(env: AppEnv["Bindings"], orgId: string) {
  const org = await env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ plan_slug: string }>();
  return PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];
}
