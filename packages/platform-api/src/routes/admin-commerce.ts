import type { Hono } from "hono";
import { z } from "zod";
import {
  commercePaymentProvidersSchema,
  hasPaymentWebhookSecret,
  parseCommerceManifest,
} from "@chatbot/domain";
import type { AppEnv } from "../types";
import { apiError, json, randomId } from "../lib/http";
import { requireAdminRole, requireUser } from "../lib/auth";
import { notifyOwnersPaymentPendingVerification } from "../lib/commerce-order-notify";
import {
  loadCommerceReadinessForOrg,
  orgPaymentGatewayReady,
} from "../lib/commerce-readiness-load";
import { buildCatalogDraftFromUpload } from "../lib/catalog-import-pdf";
import {
  ensureOrgPaymentWebhookToken,
  paymentWebhookUrls,
} from "../lib/commerce-webhook-token";
import { isNativeInventoryEnabled } from "../lib/native-inventory";
import {
  catalogAssetPublicUrl,
  catalogAssetR2Key,
} from "./catalog-assets";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

const productImageUrlSchema = z.union([
  z.string().url().max(2048),
  z.literal(""),
]);

const productFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  promoLabel: z.string().max(80).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  featured: z.boolean().optional(),
  currency: z.string().max(8).optional(),
  imageUrl: productImageUrlSchema.optional(),
  stockQty: z.number().int().min(0).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  allowsAdditions: z.boolean().optional(),
});

function refineProductCompareAtPrice(
  d: {
    priceCents?: number;
    compareAtPriceCents?: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (d.compareAtPriceCents == null || d.priceCents == null) return;
  if (
    d.compareAtPriceCents > 0 &&
    d.compareAtPriceCents < d.priceCents
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "compare_at_must_be_gte_sale_price",
      path: ["compareAtPriceCents"],
    });
  }
}

const productBodySchema = productFieldsSchema.superRefine(
  refineProductCompareAtPrice,
);

const productPatchSchema = productFieldsSchema
  .partial()
  .superRefine(refineProductCompareAtPrice);

const onboardingBodySchema = z.object({
  sellsOnline: z.boolean(),
  catalogSource: z.enum([
    "create",
    "import_pdf",
    "import_curl",
    "api",
    "files",
  ]),
  paymentConfirmation: z.enum(["manual", "automatic"]),
  channels: z.array(z.enum(["web"])).min(1).max(4),
  orderPageBaseUrl: z.string().url().max(2048).optional(),
});

export function registerAdminCommerceRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/setup-checklist", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const orgId = auth.user.orgId!;
    const [me, products, bot, paymentGatewayConnected] = await Promise.all([
        c.env.DB.prepare(`SELECT status FROM orgs WHERE id = ?`)
          .bind(orgId)
          .first<{ status: string }>(),
        c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE org_id = ?`)
          .bind(orgId)
          .first<{ n: number }>(),
        c.env.DB.prepare(
          `SELECT id, system_prompt FROM bots WHERE org_id = ? ORDER BY created_at ASC LIMIT 1`,
        )
          .bind(orgId)
          .first<{ id: string; system_prompt: string }>(),
        orgPaymentGatewayReady(c.env, orgId),
      ]);

    const productCount = products?.n ?? 0;
    let hasKnowledgeFiles = productCount > 0;
    if (bot?.id && !hasKnowledgeFiles) {
      const docRows = await c.env.DB.prepare(
        `SELECT title, status FROM sources
         WHERE org_id = ? AND bot_id = ? AND status = 'ready'`,
      )
        .bind(orgId, bot.id)
        .all<{ title: string; status: string }>();
      const legacy = "Conexiones y credenciales";
      hasKnowledgeFiles = (docRows.results ?? []).some(
        (d) =>
          d.title !== legacy &&
          (d.title === "Políticas" ||
            d.title === "Preguntas frecuentes" ||
            d.title === "Catálogo" ||
            d.title === "Catálogo (referencia)" ||
            d.title === "Material adicional"),
      );
    }

    return json({
      subscriptionActive: me?.status === "active",
      hasPersonalityInstructions: Boolean(bot?.system_prompt?.trim()),
      hasKnowledgeFiles,
      hasProducts: productCount > 0,
      paymentGatewayConnected,
      primaryBotId: bot?.id ?? null,
    });
  });

  app.get("/v1/admin/commerce-readiness", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const data = await loadCommerceReadinessForOrg(c.env, auth.user.orgId!);
    return json(data);
  });

  app.patch("/v1/admin/commerce-onboarding", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const parsed = onboardingBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const prev = await c.env.DB.prepare(
      `SELECT mode, manifest_json FROM org_commerce_config WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ mode: string; manifest_json: string | null }>();

    const manifest = parseCommerceManifest(prev?.manifest_json);
    const profile = {
      sellsOnline: parsed.data.sellsOnline,
      catalogSource: parsed.data.catalogSource,
      paymentConfirmation: parsed.data.paymentConfirmation,
      channels: parsed.data.channels,
      completedAt: new Date().toISOString(),
    };

    const merged = {
      ...manifest,
      confirmationMode: "automatic",
      commerceProfile: parsed.data.sellsOnline ? "product_sales" : "support_only",
      orderPageBaseUrl:
        parsed.data.orderPageBaseUrl ?? manifest.orderPageBaseUrl,
      onboardingProfile: profile,
    };

    const mode = prev?.mode === "checkout_link" ? "checkout_link" : "order_only";
    await c.env.DB.prepare(
      `INSERT INTO org_commerce_config (org_id, mode, manifest_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(org_id) DO UPDATE SET
         manifest_json = excluded.manifest_json,
         updated_at = datetime('now')`,
    )
      .bind(auth.user.orgId, mode, JSON.stringify(merged))
      .run();

    const readiness = await loadCommerceReadinessForOrg(c.env, auth.user.orgId!);
    return json({ ok: true, readiness });
  });

  app.get("/v1/admin/commerce-inventory-mode", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const row = await c.env.DB.prepare(
      `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ manifest_json: string | null }>();
    const manifest = parseCommerceManifest(row?.manifest_json);
    return json({
      enabled: Boolean(manifest.nativeInventoryEnabled),
      productCount: await c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM products WHERE org_id = ? AND status = 'published'`,
      )
        .bind(auth.user.orgId)
        .first<{ n: number }>()
        .then((r) => r?.n ?? 0),
    });
  });

  app.patch("/v1/admin/commerce-inventory-mode", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
    if (!body.success) return apiError("invalid_body", 400);

    const prev = await c.env.DB.prepare(
      `SELECT mode, manifest_json FROM org_commerce_config WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ mode: string; manifest_json: string | null }>();

    const manifest = parseCommerceManifest(prev?.manifest_json);
    const onboarding = manifest.onboardingProfile ?? {};
    const merged = {
      ...manifest,
      nativeInventoryEnabled: body.data.enabled,
      commerceProfile: body.data.enabled ? "product_sales" : manifest.commerceProfile,
      onboardingProfile: body.data.enabled
        ? {
            ...onboarding,
            sellsOnline: true,
            catalogSource: onboarding.catalogSource ?? "create",
            channels: onboarding.channels?.length
              ? onboarding.channels
              : ["web"],
          }
        : onboarding,
    };

    const mode = prev?.mode === "checkout_link" ? "checkout_link" : "order_only";
    await c.env.DB.prepare(
      `INSERT INTO org_commerce_config (org_id, mode, manifest_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(org_id) DO UPDATE SET
         manifest_json = excluded.manifest_json,
         updated_at = datetime('now')`,
    )
      .bind(auth.user.orgId, mode, JSON.stringify(merged))
      .run();

    return json({ ok: true, enabled: body.data.enabled });
  });

  app.post("/v1/admin/products/upload-image", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    if (!(await isNativeInventoryEnabled(c.env, auth.user.orgId!))) {
      return apiError(
        "native_inventory_disabled",
        403,
        undefined,
        "Activa la gestión de inventario en Integraciones.",
      );
    }

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("invalid_body", 400);
    const contentType = file.type || "application/octet-stream";
    if (!IMAGE_TYPES.has(contentType)) {
      return apiError("invalid_body", 400, undefined, "Usa JPG, PNG, WebP o GIF.");
    }
    const buf = await file.arrayBuffer();
    if (buf.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
      return apiError("invalid_body", 400, undefined, "Imagen máximo 5 MB.");
    }

    const ext =
      contentType === "image/png"
        ? ".png"
        : contentType === "image/webp"
          ? ".webp"
          : contentType === "image/gif"
            ? ".gif"
            : ".jpg";
    const fileName = `${randomId()}${ext}`;
    const orgId = auth.user.orgId!;
    await c.env.SOURCES.put(catalogAssetR2Key(orgId, fileName), buf, {
      httpMetadata: { contentType },
    });
    const apiBase =
      c.env.PLATFORM_API_URL?.trim() || new URL(c.req.url).origin;
    return json({
      imageUrl: catalogAssetPublicUrl(apiBase, orgId, fileName),
    });
  });

  app.get("/v1/admin/products", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    if (!(await isNativeInventoryEnabled(c.env, auth.user.orgId!))) {
      return apiError(
        "native_inventory_disabled",
        403,
        undefined,
        "Activa la gestión de inventario en Integraciones.",
      );
    }

    const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(c.req.query("limit") ?? 25) || 25),
    );
    const offset = (page - 1) * limit;

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM products WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ n: number }>();

    const rows = await c.env.DB.prepare(
      `SELECT id, name, description, price_cents, compare_at_price_cents, promo_label,
              currency, image_url, stock_qty, status, allows_additions, category, featured,
              created_at, updated_at
       FROM products WHERE org_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(auth.user.orgId, limit, offset)
      .all();

    return json({
      products: rows.results ?? [],
      page,
      limit,
      total: totalRow?.n ?? 0,
    });
  });

  app.post("/v1/admin/products", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    if (!(await isNativeInventoryEnabled(c.env, auth.user.orgId!))) {
      return apiError(
        "native_inventory_disabled",
        403,
        undefined,
        "Activa la gestión de inventario en Integraciones.",
      );
    }

    const parsed = productBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const id = randomId();
    const d = parsed.data;
    await c.env.DB.prepare(
      `INSERT INTO products (id, org_id, name, description, price_cents, compare_at_price_cents, promo_label,
       currency, image_url, stock_qty, status, allows_additions, category, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        auth.user.orgId,
        d.name,
        d.description ?? null,
        d.priceCents,
        d.compareAtPriceCents ?? null,
        d.promoLabel?.trim() || null,
        d.currency ?? "COP",
        d.imageUrl || null,
        d.stockQty ?? null,
        d.status ?? "draft",
        d.allowsAdditions ? 1 : 0,
        d.category?.trim() || null,
        d.featured ? 1 : 0,
      )
      .run();

    return json({ id });
  });

  app.patch("/v1/admin/products/:id", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    if (!(await isNativeInventoryEnabled(c.env, auth.user.orgId!))) {
      return apiError(
        "native_inventory_disabled",
        403,
        undefined,
        "Activa la gestión de inventario en Integraciones.",
      );
    }

    const parsed = productPatchSchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const id = c.req.param("id");
    const existing = await c.env.DB.prepare(
      `SELECT id FROM products WHERE id = ? AND org_id = ?`,
    )
      .bind(id, auth.user.orgId)
      .first();
    if (!existing) return apiError("not_found", 404);

    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (d.name != null) {
      fields.push("name = ?");
      values.push(d.name);
    }
    if (d.description !== undefined) {
      fields.push("description = ?");
      values.push(d.description ?? null);
    }
    if (d.priceCents != null) {
      fields.push("price_cents = ?");
      values.push(d.priceCents);
    }
    if (d.compareAtPriceCents !== undefined) {
      fields.push("compare_at_price_cents = ?");
      values.push(d.compareAtPriceCents);
    }
    if (d.promoLabel !== undefined) {
      fields.push("promo_label = ?");
      values.push(d.promoLabel?.trim() || null);
    }
    if (d.currency != null) {
      fields.push("currency = ?");
      values.push(d.currency);
    }
    if (d.imageUrl !== undefined) {
      fields.push("image_url = ?");
      values.push(d.imageUrl || null);
    }
    if (d.stockQty !== undefined) {
      fields.push("stock_qty = ?");
      values.push(d.stockQty);
    }
    if (d.status != null) {
      fields.push("status = ?");
      values.push(d.status);
    }
    if (d.allowsAdditions !== undefined) {
      fields.push("allows_additions = ?");
      values.push(d.allowsAdditions ? 1 : 0);
    }
    if (d.category !== undefined) {
      fields.push("category = ?");
      values.push(d.category?.trim() || null);
    }
    if (d.featured !== undefined) {
      fields.push("featured = ?");
      values.push(d.featured ? 1 : 0);
    }
    if (!fields.length) return json({ ok: true });

    fields.push("updated_at = datetime('now')");
    values.push(id, auth.user.orgId);

    await c.env.DB.prepare(
      `UPDATE products SET ${fields.join(", ")} WHERE id = ? AND org_id = ?`,
    )
      .bind(...values)
      .run();

    return json({ ok: true });
  });

  app.delete("/v1/admin/products/:id", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
    ]);
    if ("response" in auth) return auth.response;

    const id = c.req.param("id");
    await c.env.DB.prepare(`DELETE FROM products WHERE id = ? AND org_id = ?`)
      .bind(id, auth.user.orgId)
      .run();
    return json({ ok: true });
  });

  app.get("/v1/admin/sales-orders", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const from = c.req.query("from")?.trim();
    const to = c.req.query("to")?.trim();
    const mode = c.req.query("mode")?.trim();
    const sort = c.req.query("sort") === "asc" ? "ASC" : "DESC";

    let sql = `SELECT id, public_ref, status, currency, subtotal_cents, summary, buyer_json,
                      fulfillment_json, lines_json, conversation_id,
                      payment_evidence_meta_json, created_at, updated_at
               FROM sales_orders
               WHERE org_id = ?
                 AND status IN ('paid', 'pending_fulfillment')`;
    const binds: unknown[] = [auth.user.orgId];

    if (from) {
      sql += ` AND created_at >= ?`;
      binds.push(from);
    }
    if (to) {
      sql += ` AND created_at <= ?`;
      binds.push(to);
    }
    if (mode === "pickup") {
      sql += ` AND json_extract(fulfillment_json, '$.mode') = 'pickup'`;
    } else if (mode === "delivery") {
      sql += ` AND json_extract(fulfillment_json, '$.mode') = 'delivery'`;
    } else if (mode === "pending_delivery_info") {
      sql += ` AND fulfillment_json IS NULL`;
    }

    sql += ` ORDER BY created_at ${sort} LIMIT 200`;

    const rows = await c.env.DB.prepare(sql).bind(...binds).all();
    return json({ orders: rows.results ?? [] });
  });

  app.post("/v1/admin/sales-orders/:id/confirm-payment", async (c) => {
    return apiError(
      "manual_payment_removed",
      410,
      undefined,
      "Desk ya no confirma pagos manualmente. Usa pasarela y webhooks.",
    );
  });

  app.get("/v1/admin/commerce-payment-webhooks", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const token = await ensureOrgPaymentWebhookToken(
      c.env,
      auth.user.orgId!,
    );
    const row = await c.env.DB.prepare(
      `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ manifest_json: string | null }>();
    const manifest = parseCommerceManifest(row?.manifest_json);

    return json({
      token,
      urls: paymentWebhookUrls(c.env, token),
      confirmationMode: manifest.confirmationMode,
      paymentProviders: manifest.paymentProviders ?? {},
    });
  });

  app.patch("/v1/admin/commerce-payment-webhooks", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const bodySchema = z.object({
      confirmationMode: z.enum(["manual", "automatic"]).optional(),
      paymentProviders: commercePaymentProvidersSchema.optional(),
    });
    const parsed = bodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const prev = await c.env.DB.prepare(
      `SELECT mode, manifest_json FROM org_commerce_config WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ mode: string; manifest_json: string | null }>();

    const manifest = parseCommerceManifest(prev?.manifest_json);
    const merged = {
      ...manifest,
      ...parsed.data,
      paymentProviders: {
        ...manifest.paymentProviders,
        ...parsed.data.paymentProviders,
      },
    };
    if (
      merged.confirmationMode === "automatic" &&
      !hasPaymentWebhookSecret(merged.paymentProviders)
    ) {
      return apiError(
        "payment_webhook_secret_required",
        400,
        undefined,
        "En modo automático activa una plantilla de pago en Integraciones (secret de webhook).",
      );
    }
    const mode = prev?.mode === "checkout_link" ? "checkout_link" : "order_only";

    await c.env.DB.prepare(
      `INSERT INTO org_commerce_config (org_id, mode, manifest_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(org_id) DO UPDATE SET
         manifest_json = excluded.manifest_json,
         updated_at = datetime('now')`,
    )
      .bind(auth.user.orgId, mode, JSON.stringify(merged))
      .run();

    const token = await ensureOrgPaymentWebhookToken(c.env, auth.user.orgId!);
    return json({
      ok: true,
      urls: paymentWebhookUrls(c.env, token),
      confirmationMode: merged.confirmationMode,
    });
  });

  app.get("/v1/admin/catalog-imports", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const rows = await c.env.DB.prepare(
      `SELECT id, status, created_at, updated_at, payload_json
       FROM catalog_import_drafts WHERE org_id = ?
       ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(auth.user.orgId)
      .all();

    const drafts = (rows.results ?? []).map((r) => {
      const payload = JSON.parse(String(r.payload_json ?? "{}")) as {
        items?: unknown[];
        sourceFilename?: string;
      };
      return {
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        itemCount: payload.items?.length ?? 0,
        sourceFilename: payload.sourceFilename ?? null,
      };
    });
    return json({ drafts });
  });

  app.get("/v1/admin/catalog-imports/:id", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const row = await c.env.DB.prepare(
      `SELECT id, status, payload_json, created_at FROM catalog_import_drafts
       WHERE id = ? AND org_id = ?`,
    )
      .bind(c.req.param("id"), auth.user.orgId)
      .first<{
        id: string;
        status: string;
        payload_json: string;
        created_at: string;
      }>();
    if (!row) return apiError("not_found", 404);
    return json({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload_json),
    });
  });

  app.post("/v1/admin/catalog-imports/pdf", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;
    if (!(await isNativeInventoryEnabled(c.env, auth.user.orgId!))) {
      return apiError("native_inventory_disabled", 403);
    }

    const form = await c.req.formData();
    const file = form.get("file");
    const currency = String(form.get("currency") ?? "COP").slice(0, 8);
    if (!(file instanceof File)) return apiError("invalid_body", 400);
    if (!/\.pdf$/i.test(file.name) && !file.type.includes("pdf")) {
      return apiError("invalid_body", 400, undefined, "Solo PDF por ahora.");
    }

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE org_id = ? ORDER BY created_at ASC LIMIT 1`,
    )
      .bind(auth.user.orgId)
      .first<{ id: string }>();

    const payload = await buildCatalogDraftFromUpload(c.env, file, currency);
    const id = randomId();
    await c.env.DB.prepare(
      `INSERT INTO catalog_import_drafts (id, org_id, bot_id, payload_json, status)
       VALUES (?, ?, ?, ?, 'pending_review')`,
    )
      .bind(
        id,
        auth.user.orgId,
        bot?.id ?? null,
        JSON.stringify(payload),
      )
      .run();

    return json({ id, payload });
  });

  app.post("/v1/admin/catalog-imports/:id/publish", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const draftId = c.req.param("id");
    const row = await c.env.DB.prepare(
      `SELECT payload_json, status FROM catalog_import_drafts WHERE id = ? AND org_id = ?`,
    )
      .bind(draftId, auth.user.orgId)
      .first<{ payload_json: string; status: string }>();
    if (!row) return apiError("not_found", 404);
    if (row.status !== "pending_review") {
      return apiError("invalid_state", 400);
    }

    const payload = JSON.parse(row.payload_json) as {
      items: Array<{
        name: string;
        description?: string;
        priceCents: number;
      }>;
      currency?: string;
    };
    const currency = payload.currency ?? "COP";
    let created = 0;
    for (const item of payload.items ?? []) {
      const id = randomId();
      await c.env.DB.prepare(
        `INSERT INTO products (id, org_id, name, description, price_cents, currency, status)
         VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      )
        .bind(
          id,
          auth.user.orgId,
          item.name.slice(0, 200),
          item.description?.slice(0, 4000) ?? null,
          item.priceCents,
          currency,
        )
        .run();
      created += 1;
    }

    await c.env.DB.prepare(
      `UPDATE catalog_import_drafts SET status = 'applied', updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(draftId)
      .run();

    return json({ ok: true, productsCreated: created });
  });

  app.post("/v1/admin/catalog-imports/:id/discard", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    await c.env.DB.prepare(
      `UPDATE catalog_import_drafts SET status = 'discarded', updated_at = datetime('now')
       WHERE id = ? AND org_id = ?`,
    )
      .bind(c.req.param("id"), auth.user.orgId)
      .run();
    return json({ ok: true });
  });
}
