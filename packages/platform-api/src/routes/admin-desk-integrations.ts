import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAdminRole } from "../lib/auth";
import { apiError, json } from "../lib/http";
import {
  activateOrgIntegration,
  listOrgDeskIntegrations,
  saveOrgIntegrationValues,
} from "../lib/desk-integrations";
import { attachPaymentWebhookToIntegrations } from "../lib/commerce-payment-webhook-info";

export function registerAdminDeskIntegrationRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/desk-integrations", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const raw = await listOrgDeskIntegrations(c.env, auth.user.orgId!);
    const integrations = await attachPaymentWebhookToIntegrations(
      c.env,
      auth.user.orgId!,
      raw,
    );
    return json({ integrations });
  });

  app.put("/v1/admin/desk-integrations/:instanceId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const parsed = z
      .object({ values: z.record(z.string()) })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const result = await saveOrgIntegrationValues(
      c.env,
      auth.user.orgId!,
      c.req.param("instanceId"),
      parsed.data.values,
    );
    if (!result.ok) {
      return apiError(
        result.error,
        400,
        undefined,
        "detail" in result ? result.detail : undefined,
      );
    }

    const items = await listOrgDeskIntegrations(c.env, auth.user.orgId!);
    const integrations = await attachPaymentWebhookToIntegrations(
      c.env,
      auth.user.orgId!,
      items,
    );
    return json({ ok: true, integrations });
  });

  app.post("/v1/admin/desk-integrations/:instanceId/activate", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const result = await activateOrgIntegration(
      c.env,
      auth.user.orgId!,
      c.req.param("instanceId"),
    );
    if (!result.ok) {
      return apiError(
        result.error,
        400,
        undefined,
        "detail" in result ? result.detail : undefined,
      );
    }

    const items = await listOrgDeskIntegrations(c.env, auth.user.orgId!);
    const integrations = await attachPaymentWebhookToIntegrations(
      c.env,
      auth.user.orgId!,
      items,
    );
    return json({ ok: true, integrations });
  });
}
