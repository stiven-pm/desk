import type { Hono } from "hono";
import { createSourceBodySchema } from "@chatbot/domain";
import type { AppEnv } from "../types";
import { authenticateApiKey } from "../lib/api-key-auth";
import { apiError, json } from "../lib/http";
import { createSourceUpload } from "../lib/ingest";
import {
  getIdempotentResponse,
  storeIdempotentResponse,
} from "../lib/idempotency";

function getSecretKey(request: Request): string | null {
  const token =
    request.headers.get("X-Api-Key") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return token;
}

export function registerTenantRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/tenant/sources", async (c) => {
    const token = getSecretKey(c.req.raw);
    if (!token) return apiError("unauthorized", 401);
    const auth = await authenticateApiKey(c.env, token);
    if (!auth || auth.kind !== "secret") return apiError("unauthorized", 401);

    const rows = await c.env.DB.prepare(
      `SELECT id, bot_id, name, kind, status, created_at FROM sources
       WHERE org_id = ? ORDER BY created_at DESC LIMIT 100`,
    )
      .bind(auth.orgId)
      .all();
    return json({ sources: rows.results });
  });

  app.post("/v1/tenant/sources/upload", async (c) => {
    const token = getSecretKey(c.req.raw);
    if (!token) return apiError("unauthorized", 401);
    const auth = await authenticateApiKey(c.env, token);
    if (!auth || auth.kind !== "secret") return apiError("unauthorized", 401);

    const idempotencyKey = c.req.header("Idempotency-Key");
    if (!idempotencyKey) return apiError("idempotency_key_required", 400);

    const cached = await getIdempotentResponse(c.env, auth.orgId, idempotencyKey);
    if (cached) return cached;

    const form = await c.req.formData();
    const botId = String(form.get("botId") ?? "");
    const file = form.get("file");
    const title = String(form.get("title") ?? form.get("name") ?? "upload");
    const description = String(form.get("description") ?? "");
    const documentFilename = file instanceof File ? file.name : undefined;
    if (!botId || !(file instanceof File)) return apiError("invalid_body", 400);

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.orgId)
      .first();
    if (!bot) return apiError("not_found", 404);

    const buf = await file.arrayBuffer();
    const result = await createSourceUpload(c.env, {
      orgId: auth.orgId,
      botId,
      title,
      description,
      documentFilename,
      contentType: file.type || "text/plain",
      body: buf,
      idempotencyKey,
    });

    const body = JSON.stringify(result);
    await storeIdempotentResponse(c.env, auth.orgId, idempotencyKey, 200, body);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  app.post("/v1/tenant/sources", async (c) => {
    const token = getSecretKey(c.req.raw);
    if (!token) return apiError("unauthorized", 401);
    const auth = await authenticateApiKey(c.env, token);
    if (!auth || auth.kind !== "secret") return apiError("unauthorized", 401);

    const parsed = createSourceBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(parsed.data.botId, auth.orgId)
      .first();
    if (!bot) return apiError("not_found", 404);

    const sourceId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO sources (id, org_id, bot_id, name, kind, status, url)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
      .bind(
        sourceId,
        auth.orgId,
        parsed.data.botId,
        parsed.data.name,
        parsed.data.kind,
        parsed.data.url ?? null,
      )
      .run();

    return json({ sourceId, status: "pending" });
  });
}
