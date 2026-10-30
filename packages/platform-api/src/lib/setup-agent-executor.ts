import {
  createHttpToolSchema,
  planAllowsIntegrations,
  planFromSlug,
  PLAN_LIMITS,
  upsertConnectorSchema,
  upsertMcpServerSchema,
} from "@chatbot/domain";
import {
  formatSkillsForPrompt,
  loadBotSkills,
} from "@chatbot/runtime/skills/load-bot-skills";
import { truncateToolOutput } from "@chatbot/runtime/harness/setup-output";
import type { Env } from "../types";
import {
  assertSetupMutationAllowed,
} from "./setup-agent-permissions";
import { syncMcpServerAfterUpsert } from "./mcp-catalog-sync";
import { decryptSecret, encryptSecret } from "./crypto";
import { randomId } from "./http";
import { invalidateBotCache } from "./tenant-cache";
import {
  materializeConnectorTools,
  persistConnectorTools,
} from "./connectors";
import { enrichConnectorConfig } from "./connector-enrich";
import { assertPublicHttpsUrl, isDocFetchAllowed } from "./setup-agent-ssrf";
import { importOpenApiFromUrl } from "./integration-openapi-import";
import {
  createCredentialRequest,
  requestCredentialsSchema,
} from "./setup-agent-credentials";
import { queueEnterpriseShellJob } from "./enterprise-shell";

export type SetupExecutorContext = {
  env: Env;
  botId: string;
  orgId: string;
  userId: string;
};

async function planLimits(env: Env, orgId: string) {
  const row = await env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ plan_slug: string }>();
  return PLAN_LIMITS[planFromSlug(row?.plan_slug ?? "starter")];
}

function encKey(env: Env): string {
  const k = env.ENCRYPTION_KEY?.trim();
  if (!k) throw new Error("encryption_not_configured");
  return k;
}

async function recordSetupAudit(
  env: Env,
  ctx: SetupExecutorContext,
  toolName: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO setup_agent_audit (id, org_id, bot_id, user_id, tool_name)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(randomId(), ctx.orgId, ctx.botId, ctx.userId, toolName)
    .run();
}

export async function executeSetupMetaTool(
  ctx: SetupExecutorContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { env, botId, orgId } = ctx;
  const allowed = await assertSetupMutationAllowed(env, orgId, name);
  if (!allowed.ok) {
    return JSON.stringify({ error: allowed.error });
  }
  await recordSetupAudit(env, ctx, name);
  const limits = await planLimits(env, orgId);
  const integrationTools = new Set([
    "desk_add_http_tool",
    "desk_register_mcp_server",
    "desk_upsert_connector",
    "desk_probe_http",
    "desk_fetch_docs",
    "desk_import_openapi_url",
  ]);
  if (!planAllowsIntegrations(limits) && integrationTools.has(name)) {
    return JSON.stringify({
      error: "plan_integration_limit",
      hint: "Sube a Growth para conectar APIs, MCP y conectores.",
    });
  }

  switch (name) {
    case "desk_workspace_status": {
      const bot = await env.DB.prepare(
        `SELECT name, system_prompt FROM bots WHERE id = ? AND org_id = ?`,
      )
        .bind(botId, orgId)
        .first<{ name: string; system_prompt: string }>();
      if (!bot) return JSON.stringify({ error: "not_found" });

      const docs = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM sources WHERE bot_id = ? AND org_id = ?`,
      )
        .bind(botId, orgId)
        .first<{ n: number }>();

      const http = await env.DB.prepare(
        `SELECT name, method, path, enabled FROM bot_http_tools WHERE bot_id = ? LIMIT 40`,
      )
        .bind(botId)
        .all();

      const mcp = await env.DB.prepare(
        `SELECT name, server_url, enabled FROM bot_mcp_servers WHERE bot_id = ?`,
      )
        .bind(botId)
        .all();

      const connectors = await env.DB.prepare(
        `SELECT connector_key, status, enabled FROM bot_connectors WHERE bot_id = ?`,
      )
        .bind(botId)
        .all();

      const skills = await loadBotSkills(env.DB, botId, "draft_and_published");

      return JSON.stringify({
        botName: bot.name,
        instructionsPreview: bot.system_prompt.slice(0, 500),
        documentsCount: docs?.n ?? 0,
        httpTools: http.results ?? [],
        mcpServers: mcp.results ?? [],
        connectors: connectors.results ?? [],
        skills: skills.map((s) => ({
          slug: s.slug,
          title: s.title,
          status: s.status,
        })),
        skillsPromptPreview: formatSkillsForPrompt(skills, "summary").slice(
          0,
          1200,
        ),
        catalogToolCount: http.results?.length ?? 0,
      });
    }

    case "desk_skill_read": {
      const slug = String(args.slug ?? "");
      if (!slug) return JSON.stringify({ error: "slug_required" });
      const row = await env.DB.prepare(
        `SELECT slug, title, description, body_md, status FROM bot_skills WHERE bot_id = ? AND slug = ?`,
      )
        .bind(botId, slug)
        .first<{
          slug: string;
          title: string;
          description: string;
          body_md: string;
          status: string;
        }>();
      if (!row) return JSON.stringify({ error: "skill_not_found" });
      return JSON.stringify({
        slug: row.slug,
        title: row.title,
        description: row.description,
        body_md: row.body_md,
        status: row.status,
      });
    }

    case "desk_set_instructions": {
      const instructions = String(args.instructions ?? "").slice(0, 24_000);
      if (!instructions.trim()) {
        return JSON.stringify({ error: "instructions_required" });
      }
      await env.DB.prepare(
        `UPDATE bots SET system_prompt = ? WHERE id = ? AND org_id = ?`,
      )
        .bind(instructions, botId, orgId)
        .run();
      await invalidateBotCache(env, botId);
      return JSON.stringify({ ok: true, chars: instructions.length });
    }

    case "desk_add_http_tool": {
      const key = encKey(env);
      const parsed = createHttpToolSchema.safeParse({
        ...args,
        baseUrl: args.baseUrl,
      });
      if (!parsed.success) {
        return JSON.stringify({ error: "invalid_body", details: parsed.error.flatten() });
      }
      if (!parsed.data.baseUrl) {
        return JSON.stringify({ error: "base_url_required" });
      }
      if (limits.maxHttpToolsPerBot <= 0) {
        return JSON.stringify({ error: "plan_tool_limit" });
      }
      const count = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM bot_http_tools WHERE bot_id = ?`,
      )
        .bind(botId)
        .first<{ n: number }>();
      if ((count?.n ?? 0) >= limits.maxHttpToolsPerBot) {
        return JSON.stringify({ error: "plan_tool_limit" });
      }

      const authSecret = args.authSecret
        ? String(args.authSecret)
        : undefined;
      const authType = (args.authType as string) || "none";
      let authSecretEnc: string | null = null;
      if (authSecret && authType !== "none") {
        authSecretEnc = await encryptSecret(authSecret, key);
      }

      const id = randomId();
      await env.DB.prepare(
        `INSERT INTO bot_http_tools (id, bot_id, name, description, method, path, base_url, auth_type, auth_header_name, auth_secret_enc, parameters_json, source, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
      )
        .bind(
          id,
          botId,
          parsed.data.name,
          parsed.data.description,
          parsed.data.method,
          parsed.data.path,
          parsed.data.baseUrl,
          authType,
          args.authHeaderName ? String(args.authHeaderName) : null,
          authSecretEnc,
          JSON.stringify(parsed.data.parameters ?? []),
          parsed.data.enabled === false ? 0 : 1,
        )
        .run();
      await invalidateBotCache(env, botId);
      return truncateToolOutput(
        JSON.stringify({ ok: true, id, name: parsed.data.name }),
      );
    }

    case "desk_register_mcp_server": {
      const key = encKey(env);
      const parsed = upsertMcpServerSchema.safeParse(args);
      if (!parsed.success) {
        return JSON.stringify({ error: "invalid_body" });
      }
      if (limits.maxMcpServersPerBot <= 0) {
        return JSON.stringify({ error: "plan_mcp_limit" });
      }
      const existing = await env.DB.prepare(
        `SELECT id FROM bot_mcp_servers WHERE bot_id = ? AND name = ?`,
      )
        .bind(botId, parsed.data.name)
        .first<{ id: string }>();

      const headersEnc = parsed.data.headers
        ? await encryptSecret(JSON.stringify(parsed.data.headers), key)
        : null;

      const id = existing?.id ?? randomId();
      if (existing) {
        await env.DB.prepare(
          `UPDATE bot_mcp_servers SET server_url = ?, headers_enc = ?, enabled = ? WHERE id = ? AND bot_id = ?`,
        )
          .bind(
            parsed.data.serverUrl,
            headersEnc,
            parsed.data.enabled === false ? 0 : 1,
            id,
            botId,
          )
          .run();
      } else {
        const n = await env.DB.prepare(
          `SELECT COUNT(*) as c FROM bot_mcp_servers WHERE bot_id = ?`,
        )
          .bind(botId)
          .first<{ c: number }>();
        if ((n?.c ?? 0) >= limits.maxMcpServersPerBot) {
          return JSON.stringify({ error: "plan_mcp_limit" });
        }
        await env.DB.prepare(
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
      await invalidateBotCache(env, botId);
      try {
        await syncMcpServerAfterUpsert(env, botId, id, key);
      } catch {
        /* sync best-effort */
      }
      return truncateToolOutput(
        JSON.stringify({ ok: true, id, name: parsed.data.name }),
      );
    }

    case "desk_upsert_connector": {
      const key = encKey(env);
      const parsed = upsertConnectorSchema.safeParse(args);
      if (!parsed.success) {
        return JSON.stringify({ error: "invalid_body" });
      }
      let mergedConfig = parsed.data.config;
      const existing = await env.DB.prepare(
        `SELECT id, config_enc FROM bot_connectors WHERE bot_id = ? AND connector_key = ?`,
      )
        .bind(botId, parsed.data.connectorKey)
        .first<{ id: string; config_enc: string }>();

      if (existing?.config_enc) {
        const prev = await decryptSecret(existing.config_enc, key);
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
        return JSON.stringify({
          error: e instanceof Error ? e.message : "connector_config_invalid",
        });
      }

      const configEnc = await encryptSecret(JSON.stringify(mergedConfig), key);
      const id = existing?.id ?? randomId();
      if (!existing) {
        const n = await env.DB.prepare(
          `SELECT COUNT(*) as c FROM bot_connectors WHERE bot_id = ?`,
        )
          .bind(botId)
          .first<{ c: number }>();
        if ((n?.c ?? 0) >= limits.maxConnectorsPerBot) {
          return JSON.stringify({ error: "plan_connector_limit" });
        }
        await env.DB.prepare(
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
      } else {
        await env.DB.prepare(
          `UPDATE bot_connectors SET config_enc = ?, enabled = ?, status = 'connected', updated_at = datetime('now') WHERE id = ?`,
        )
          .bind(
            configEnc,
            parsed.data.enabled === false ? 0 : 1,
            id,
          )
          .run();
      }
      const defs = materializeConnectorTools(
        parsed.data.connectorKey,
        mergedConfig,
      );
      await persistConnectorTools(env.DB, botId, id, defs, key);
      await invalidateBotCache(env, botId);
      return JSON.stringify({
        ok: true,
        connectorId: id,
        toolsMaterialized: defs.length,
      });
    }

    case "desk_probe_http": {
      const url = assertPublicHttpsUrl(String(args.url ?? ""));
      const method = args.method === "HEAD" ? "HEAD" : "GET";
      try {
        const res = await fetch(url.toString(), {
          method,
          signal: AbortSignal.timeout(15_000),
          headers: { Accept: "application/json, text/plain, */*" },
        });
        const body =
          method === "GET"
            ? (await res.text()).slice(0, 2000)
            : "";
        return JSON.stringify({
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get("content-type"),
          bodyPreview: body,
        });
      } catch (e) {
        return JSON.stringify({
          ok: false,
          error: e instanceof Error ? e.message : "probe_failed",
        });
      }
    }

    case "desk_fetch_docs": {
      const url = assertPublicHttpsUrl(String(args.url ?? ""));
      if (!isDocFetchAllowed(url)) {
        return JSON.stringify({
          error: "doc_host_not_allowed",
          hint: "Usa URLs de documentación oficial del proveedor.",
        });
      }
      const maxChars = Math.min(
        24_000,
        Math.max(2000, Number(args.maxChars) || 12_000),
      );
      try {
        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(20_000),
          headers: { Accept: "text/html, application/json, text/plain, */*" },
        });
        const text = (await res.text()).slice(0, maxChars);
        return JSON.stringify({
          ok: res.ok,
          status: res.status,
          url: url.toString(),
          text,
        });
      } catch (e) {
        return JSON.stringify({
          error: e instanceof Error ? e.message : "fetch_failed",
        });
      }
    }

    case "desk_skill_save": {
      const slug = String(args.slug ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 64);
      const title = String(args.title ?? "").slice(0, 200);
      const description = String(args.description ?? "").slice(0, 500);
      const body_md = String(args.body_md ?? "").slice(0, 40_000);
      const publish = Boolean(args.publish);
      if (!slug || !title || !body_md.trim()) {
        return JSON.stringify({ error: "skill_fields_required" });
      }
      const status = publish ? "published" : "draft";
      const existing = await env.DB.prepare(
        `SELECT id FROM bot_skills WHERE bot_id = ? AND slug = ?`,
      )
        .bind(botId, slug)
        .first<{ id: string }>();
      const id = existing?.id ?? randomId();
      if (existing) {
        await env.DB.prepare(
          `UPDATE bot_skills SET title = ?, description = ?, body_md = ?, status = ?, updated_at = datetime('now')
           WHERE id = ? AND bot_id = ?`,
        )
          .bind(title, description, body_md, status, id, botId)
          .run();
      } else {
        await env.DB.prepare(
          `INSERT INTO bot_skills (id, bot_id, slug, title, description, body_md, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(id, botId, slug, title, description, body_md, status)
          .run();
      }
      await invalidateBotCache(env, botId);
      return JSON.stringify({ ok: true, slug, status });
    }

    case "desk_skill_publish": {
      const slug = args.slug ? String(args.slug) : null;
      if (slug) {
        const draft = await env.DB.prepare(
          `SELECT status FROM bot_skills WHERE bot_id = ? AND slug = ?`,
        )
          .bind(botId, slug)
          .first<{ status: string }>();
        if (!draft) return JSON.stringify({ error: "skill_not_found" });
        if (draft.status === "archived") {
          return JSON.stringify({ error: "skill_archived" });
        }
        await env.DB.prepare(
          `UPDATE bot_skills SET status = 'published', updated_at = datetime('now')
           WHERE bot_id = ? AND slug = ?`,
        )
          .bind(botId, slug)
          .run();
      } else {
        await env.DB.prepare(
          `UPDATE bot_skills SET status = 'published', updated_at = datetime('now')
           WHERE bot_id = ? AND status = 'draft'`,
        )
          .bind(botId)
          .run();
      }
      await invalidateBotCache(env, botId);
      return JSON.stringify({ ok: true });
    }

    case "desk_skill_archive": {
      const slug = String(args.slug ?? "");
      if (!slug) return JSON.stringify({ error: "slug_required" });
      await env.DB.prepare(
        `UPDATE bot_skills SET status = 'archived', updated_at = datetime('now')
         WHERE bot_id = ? AND slug = ?`,
      )
        .bind(botId, slug)
        .run();
      await invalidateBotCache(env, botId);
      return JSON.stringify({ ok: true });
    }

    case "desk_request_credentials": {
      const parsed = requestCredentialsSchema.safeParse(args);
      if (!parsed.success) {
        return JSON.stringify({
          error: "invalid_credential_request",
          details: parsed.error.flatten(),
        });
      }
      const created = await createCredentialRequest(env, {
        botId,
        orgId,
        body: parsed.data,
      });
      return JSON.stringify({
        ok: true,
        requestId: created.id,
        ui: "credential_modal",
        fields: created.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required !== false,
        })),
        message:
          "El administrador verá un formulario en el panel. No repitas secretos en el chat.",
      });
    }

    case "desk_import_openapi_url": {
      const result = await importOpenApiFromUrl(env, {
        botId,
        specUrl: String(args.specUrl ?? ""),
        baseUrl: String(args.baseUrl ?? ""),
        authType: args.authType as "none" | "bearer" | "header" | undefined,
        authHeaderName: args.authHeaderName
          ? String(args.authHeaderName)
          : undefined,
        authSecret: args.authSecret ? String(args.authSecret) : undefined,
      });
      if (!result.ok) {
        return JSON.stringify({ error: result.error });
      }
      await invalidateBotCache(env, botId);
      return JSON.stringify({
        ok: true,
        configId: result.configId,
        toolsSynced: result.toolsSynced,
        parseError: result.error,
      });
    }

    case "desk_enterprise_shell_queue": {
      const result = await queueEnterpriseShellJob(env, {
        orgId,
        botId,
        createdBy: ctx.userId,
        summary: String(args.summary ?? ""),
        instructionsMd: String(args.instructionsMd ?? ""),
      });
      if (!result.ok) {
        return JSON.stringify({ error: result.error });
      }
      return JSON.stringify({
        ok: true,
        jobId: result.jobId,
        consoleHint: result.consoleHint,
      });
    }

    default:
      return truncateToolOutput(JSON.stringify({ error: "unknown_tool", name }));
  }
}
