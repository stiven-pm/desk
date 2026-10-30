import type { Hono } from "hono";
import {
  buildSetupAgentSystemPrompt,
  runSetupAgent,
} from "@chatbot/runtime/setup-agent/run-setup-agent";
import {
  formatSkillsForPrompt,
  loadBotSkills,
} from "@chatbot/runtime/skills/load-bot-skills";
import type { AppEnv } from "../types";
import { requireAdminRole } from "../lib/auth";
import { apiError, json } from "../lib/http";
import { executeSetupMetaTool } from "../lib/setup-agent-executor";
import {
  fulfillCredentialRequest,
  listPendingCredentialRequests,
} from "../lib/setup-agent-credentials";
import { listEnterpriseShellJobs } from "../lib/enterprise-shell";
import {
  compactSetupHistoryBlock,
  loadSetupRollingSummary,
  maybeRefreshSetupSummary,
} from "../lib/setup-agent-session";
import {
  isSetupMutatingTool,
  SETUP_VERIFY_TOOLS,
} from "../lib/setup-agent-permissions";
import { recordUsage } from "../lib/usage";
import { planFromSlug } from "@chatbot/domain";
import { z } from "zod";
import { COMMERCE_CO_NATIVE_SKILL } from "../lib/setup-skill-template-commerce-co";
import { randomId } from "../lib/http";
import { invalidateBotCache } from "../lib/tenant-cache";

async function assertBot(
  db: D1Database,
  botId: string,
  orgId: string,
): Promise<{ name: string } | null> {
  return db
    .prepare(`SELECT name FROM bots WHERE id = ? AND org_id = ?`)
    .bind(botId, orgId)
    .first<{ name: string }>();
}

const chatSchema = z.object({
  message: z.string().min(1).max(8000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(12)
    .optional(),
});

export function registerAdminSetupAgentRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/bots/:botId/setup-credentials/pending", async (c) => {
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
    const rows = await listPendingCredentialRequests(
      c.env.DB,
      botId,
      auth.user.orgId!,
    );
    const pending = rows.map((r) => ({
      id: r.id,
      title: r.title,
      purpose: r.purpose,
      fields: JSON.parse(r.fields_json) as Array<{
        key: string;
        label: string;
        type: string;
        required?: boolean;
      }>,
      createdAt: r.created_at,
    }));
    return json({ pending });
  });

  app.post(
    "/v1/admin/bots/:botId/setup-credentials/:requestId/fulfill",
    async (c) => {
      const auth = await requireAdminRole(c.req.raw, c.env, [
        "owner",
        "admin",
        "developer",
      ]);
      if ("response" in auth) return auth.response;
      const botId = c.req.param("botId");
      const requestId = c.req.param("requestId");
      if (!(await assertBot(c.env.DB, botId, auth.user.orgId!))) {
        return apiError("not_found", 404);
      }
      const body = z
        .object({ values: z.record(z.string()) })
        .safeParse(await c.req.json());
      if (!body.success) return apiError("invalid_body", 400);
      const result = await fulfillCredentialRequest(c.env, {
        botId,
        orgId: auth.user.orgId!,
        requestId,
        values: body.data.values,
      });
      if (!result.ok) return apiError(result.error, 400);
      return json({ ok: true });
    },
  );

  app.get("/v1/admin/bots/:botId/enterprise-shell/jobs", async (c) => {
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
    const jobs = await listEnterpriseShellJobs(c.env, auth.user.orgId!);
    return json({ jobs });
  });

  app.get("/v1/admin/bots/:botId/skills", async (c) => {
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
    const skills = await loadBotSkills(
      c.env.DB,
      botId,
      "draft_and_published",
    );
    return json({ skills });
  });

  app.get("/v1/admin/setup-skill-templates/commerce-co-native", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    return json(COMMERCE_CO_NATIVE_SKILL);
  });

  app.post("/v1/admin/bots/:botId/skills/install-template", async (c) => {
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
    const body = z
      .object({ template: z.enum(["commerce-co-native"]) })
      .safeParse(await c.req.json());
    if (!body.success) return apiError("invalid_body", 400);

    const tpl = COMMERCE_CO_NATIVE_SKILL;
    const existing = await c.env.DB.prepare(
      `SELECT id FROM bot_skills WHERE bot_id = ? AND slug = ?`,
    )
      .bind(botId, tpl.slug)
      .first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE bot_skills SET title = ?, description = ?, body_md = ?, status = 'draft', updated_at = datetime('now')
         WHERE bot_id = ? AND slug = ?`,
      )
        .bind(tpl.title, tpl.description, tpl.bodyMd, botId, tpl.slug)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO bot_skills (id, bot_id, slug, title, description, body_md, status)
         VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      )
        .bind(
          randomId(),
          botId,
          tpl.slug,
          tpl.title,
          tpl.description,
          tpl.bodyMd,
        )
        .run();
    }
    await invalidateBotCache(c.env, botId);
    return json({ ok: true, slug: tpl.slug, status: "draft" });
  });

  app.post("/v1/admin/bots/:botId/setup-agent/chat", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const bot = await assertBot(c.env.DB, botId, auth.user.orgId!);
    if (!bot) return apiError("not_found", 404);

    const parsed = chatSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const skills = await loadBotSkills(
      c.env.DB,
      botId,
      "draft_and_published",
    );
    const skillsSection = formatSkillsForPrompt(skills, "summary");

    const rollingSummary = await loadSetupRollingSummary(
      c.env.DB,
      botId,
      auth.user.id,
    );
    const historyBlock = compactSetupHistoryBlock({
      rollingSummary,
      history: parsed.data.history ?? [],
      maxTurns: 4,
    });

    const user = [
      historyBlock ? `${historyBlock}\n` : "",
      `Mensaje actual:\n${parsed.data.message}`,
    ]
      .filter(Boolean)
      .join("\n");

    const system = buildSetupAgentSystemPrompt({
      botName: bot.name,
      skillsSection,
    });

    const result = await runSetupAgent(c.env, {
      system,
      user,
      isMutatingTool: isSetupMutatingTool,
      isVerifyTool: (n) => SETUP_VERIFY_TOOLS.has(n),
      executeMetaTool: (name, args) =>
        executeSetupMetaTool(
          {
            env: c.env,
            botId,
            orgId: auth.user.orgId!,
            userId: auth.user.id,
          },
          name,
          args,
        ),
    });

    await maybeRefreshSetupSummary(c.env, {
      botId,
      userId: auth.user.id,
      history: parsed.data.history ?? [],
      latestAssistant: result.text,
    });

    const orgPlan = await c.env.DB.prepare(
      `SELECT plan_slug FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId!)
      .first<{ plan_slug: string }>();
    await recordUsage(c.env, auth.user.orgId!, planFromSlug(orgPlan?.plan_slug ?? "starter"), {
      setupCredits: result.creditsEstimate || 1,
    });

    const pendingRows = await listPendingCredentialRequests(
      c.env.DB,
      botId,
      auth.user.orgId!,
    );
    const pendingCredentials = pendingRows.map((r) => ({
      id: r.id,
      title: r.title,
      purpose: r.purpose,
      fields: JSON.parse(r.fields_json),
    }));

    return json({
      text: result.text,
      creditsEstimate: result.creditsEstimate,
      toolCallsUsed: result.toolCallsUsed,
      mutations: result.mutations,
      verified: result.verified,
      pendingCredentials,
    });
  });
}
