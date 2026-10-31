import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { json, apiError } from "../lib/http";
import { createOpsToken, opsLogin, requireOps } from "../lib/ops-auth";
import { provisionOrganization } from "../lib/org-provision";
import { planFromSlug, WALLET_CREDIT_PACKS, orgTimezoneSchema, resolveOrgTimezone } from "@chatbot/domain";
import {
  fetchOpsOrgMetrics,
  fetchOpsPlatformOverview,
} from "../lib/ops-economics";
import { creditWallet } from "../lib/wallet";
import { periodStartIso, randomId } from "../lib/http";
import {
  assignIntegrationToOrg,
  listOrgDeskIntegrations,
  listOrgDeskIntegrationsForOps,
  revokeOrgDeskIntegration,
} from "../lib/desk-integrations";
import { listIntegrationDefinitionsFull } from "../lib/integration-definitions";
import { z } from "zod";

export function registerOpsRoutes(app: Hono<AppEnv>): void {
  app.post("/v1/ops/auth/login", async (c) => {
    const body = (await c.req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return apiError("invalid_body", 400);
    if (!c.env.OPS_BOOTSTRAP_PASSWORD?.trim()) {
      return apiError("ops_password_not_configured", 503);
    }
    const user = await opsLogin(c.env, body.email, body.password);
    if (!user) return apiError("invalid_credentials", 401);
    const token = await createOpsToken(c.env, user);
    return json({ token, user });
  });

  app.get("/v1/ops/me", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    return json({ user: auth.user });
  });

  app.get("/v1/ops/economics/overview", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const overview = await fetchOpsPlatformOverview(c.env);
    return json({
      ...overview,
      periodStart: periodStartIso(),
      walletPacks: WALLET_CREDIT_PACKS,
    });
  });

  app.get("/v1/ops/orgs", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const orgs = await fetchOpsOrgMetrics(c.env);
    return json({ orgs, periodStart: periodStartIso() });
  });

  app.get("/v1/ops/orgs/:orgId", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const orgId = c.req.param("orgId");
    const orgs = await fetchOpsOrgMetrics(c.env);
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return apiError("not_found", 404);
    const ledger = await c.env.DB.prepare(
      `SELECT id, delta_credits, kind, usd_cents, created_at
       FROM wallet_ledger WHERE org_id = ? ORDER BY created_at DESC LIMIT 20`,
    )
      .bind(orgId)
      .all();
    const audits = await c.env.DB.prepare(
      `SELECT tool_name, created_at FROM setup_agent_audit
       WHERE org_id = ? ORDER BY created_at DESC LIMIT 30`,
    )
      .bind(orgId)
      .all();
    return json({ org, walletLedger: ledger.results ?? [], setupAudit: audits.results ?? [] });
  });

  app.post("/v1/ops/orgs", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as {
      name?: string;
      adminEmail?: string;
      plan?: string;
      status?: "invited" | "active" | "pending";
      timezone?: string;
    };
    if (!body.name || !body.adminEmail) return apiError("invalid_body", 400);
    const tzParsed = orgTimezoneSchema.safeParse(body.timezone ?? undefined);
    if (body.timezone != null && body.timezone !== "" && !tzParsed.success) {
      return apiError("invalid_body", 400);
    }

    const result = await provisionOrganization(c.env, {
      name: body.name,
      adminEmail: body.adminEmail,
      planSlug: planFromSlug(body.plan ?? "starter"),
      status: body.status ?? "invited",
      invitedByUserId: auth.user.id,
      timezone: tzParsed.success ? tzParsed.data : undefined,
    });

    return json({
      orgId: result.orgId,
      slug: result.slug,
      botId: result.botId,
      inviteUrl: result.invite.acceptUrl,
    });
  });

  app.post("/v1/ops/orgs/:orgId/wallet/grant", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { credits?: number; note?: string };
    const credits = Number(body.credits);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 5_000_000) {
      return apiError("invalid_body", 400);
    }
    await creditWallet(c.env, {
      orgId: c.req.param("orgId"),
      credits: Math.floor(credits),
      kind: "ops_grant",
      meta: { note: body.note ?? "", by: auth.user.email },
    });
    return json({ ok: true });
  });

  app.get("/v1/ops/integration-definitions", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const definitions = await listIntegrationDefinitionsFull(c.env);
    return json({ definitions });
  });

  app.get("/v1/ops/orgs/:orgId/desk-integrations", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const integrations = await listOrgDeskIntegrationsForOps(
      c.env,
      c.req.param("orgId"),
    );
    return json({ integrations });
  });

  app.post("/v1/ops/orgs/:orgId/desk-integrations", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { definitionId?: string };
    if (!body.definitionId?.trim()) return apiError("invalid_body", 400);
    const instanceId = await assignIntegrationToOrg(
      c.env,
      c.req.param("orgId"),
      body.definitionId.trim(),
    );
    return json({ ok: true, instanceId });
  });

  app.delete("/v1/ops/orgs/:orgId/desk-integrations/:instanceId", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const result = await revokeOrgDeskIntegration(
      c.env,
      c.req.param("orgId"),
      c.req.param("instanceId"),
    );
    if (!result.ok) return apiError(result.error, 404);
    return json({ ok: true });
  });

  app.patch("/v1/ops/orgs/:orgId/status", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { status?: string };
    if (!body.status) return apiError("invalid_body", 400);
    await c.env.DB.prepare(`UPDATE orgs SET status = ? WHERE id = ?`)
      .bind(body.status, c.req.param("orgId"))
      .run();
    return json({ ok: true });
  });

  app.patch("/v1/ops/orgs/:orgId/timezone", async (c) => {
    const auth = await requireOps(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { timezone?: string };
    const parsed = orgTimezoneSchema.safeParse(body.timezone);
    if (!parsed.success) return apiError("invalid_body", 400);
    await c.env.DB.prepare(`UPDATE orgs SET timezone = ? WHERE id = ?`)
      .bind(resolveOrgTimezone(parsed.data), c.req.param("orgId"))
      .run();
    return json({ ok: true, timezone: resolveOrgTimezone(parsed.data) });
  });
}
