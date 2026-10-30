import type { Hono } from "hono";
import { isLegacyPublicOrderRef, parseCommerceManifest } from "@chatbot/domain";
import { z } from "zod";
import type { AppEnv } from "../types";
import { apiError, json } from "../lib/http";
import { clientIp, rateLimitPublic } from "../middleware/rate-limit";
import { notifyOwnersPaymentPendingVerification } from "../lib/commerce-order-notify";

function publicOrderPageBase(
  manifest: ReturnType<typeof parseCommerceManifest>,
  appUrl: string | undefined,
): string {
  return (
    manifest.orderPageBaseUrl?.replace(/\/$/, "") ||
    appUrl?.replace(/\/$/, "") ||
    "https://desk.rekov.co"
  );
}

const evidenceBodySchema = z.object({
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});

type PublicOrderRow = {
  id: string;
  org_id: string;
  bot_id: string;
  public_ref: string | null;
  public_access_token: string | null;
  status: string;
  currency: string;
  subtotal_cents: number;
  summary: string;
  lines_json: string;
  created_at: string;
  manifest_json: string | null;
};

async function loadPublicOrderRow(
  db: D1Database,
  key: string,
): Promise<PublicOrderRow | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const baseSql = `SELECT o.id, o.org_id, o.bot_id, o.public_ref, o.public_access_token, o.status,
              o.currency, o.subtotal_cents, o.summary, o.lines_json, o.created_at, c.manifest_json
       FROM sales_orders o
       LEFT JOIN org_commerce_config c ON c.org_id = o.org_id`;

  if (isLegacyPublicOrderRef(trimmed)) {
    return db
      .prepare(`${baseSql} WHERE o.public_ref = ?`)
      .bind(trimmed)
      .first<PublicOrderRow>();
  }

  return db
    .prepare(`${baseSql} WHERE o.public_access_token = ?`)
    .bind(trimmed)
    .first<PublicOrderRow>();
}

function publicOrderUrlPath(row: PublicOrderRow): string {
  return encodeURIComponent(row.public_access_token ?? row.public_ref ?? row.id);
}

export function registerPublicCommerceRoutes(app: Hono<AppEnv>): void {
  /** Tras pasarela: vuelve a la página pública del pedido (chat web / resumen). */
  app.get("/v1/public/orders/:ref/payment-return", async (c) => {
    if (await rateLimitPublic(c.env, `order-return:${clientIp(c.req.raw)}`, 120)) {
      return apiError("rate_limited", 429);
    }

    const ref = c.req.param("ref").trim();
    if (!ref) return apiError("invalid_ref", 400);

    const row = await loadPublicOrderRow(c.env.DB, ref);
    if (!row) return apiError("not_found", 404);

    const manifest = parseCommerceManifest(row.manifest_json);
    const appBase = publicOrderPageBase(manifest, c.env.APP_URL);
    const incoming = new URL(c.req.url).searchParams;
    const out = new URLSearchParams();
    out.set("from_payment", "1");
    const paymentId = incoming.get("paymentId");
    if (paymentId) out.set("paymentId", paymentId);
    const redirectTarget = `${appBase}/o/${publicOrderUrlPath(row)}?${out.toString()}`;
    return c.redirect(redirectTarget, 302);
  });

  app.get("/v1/public/orders/:ref", async (c) => {
    if (await rateLimitPublic(c.env, `order-view:${clientIp(c.req.raw)}`, 60)) {
      return apiError("rate_limited", 429);
    }

    const ref = c.req.param("ref").trim();
    if (!ref) return apiError("invalid_ref", 400);

    const row = await loadPublicOrderRow(c.env.DB, ref);

    if (!row) return apiError("not_found", 404);

    const manifest = parseCommerceManifest(row.manifest_json);
    const appBase = publicOrderPageBase(manifest, c.env.APP_URL);
    const chatReturnUrl = `${appBase}/o/${publicOrderUrlPath(row)}`;
    return json({
      publicRef: row.public_ref,
      status: row.status,
      currency: row.currency,
      subtotalCents: row.subtotal_cents,
      summary: row.summary,
      lines: JSON.parse(row.lines_json || "[]"),
      createdAt: row.created_at,
      paymentInstructions: manifest.paymentInstructions ?? null,
      chatReturnUrl,
    });
  });

  app.post("/v1/public/orders/:ref/payment-evidence", async (c) => {
    if (
      await rateLimitPublic(
        c.env,
        `order-evidence:${clientIp(c.req.raw)}`,
        20,
      )
    ) {
      return apiError("rate_limited", 429);
    }

    const ref = c.req.param("ref").trim();
    const parsed = evidenceBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const row = await loadPublicOrderRow(c.env.DB, ref);

    if (!row) return apiError("not_found", 404);
    if (!["awaiting_payment", "created"].includes(row.status)) {
      return apiError("invalid_order_state", 400);
    }

    const meta = {
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
      reportedAt: new Date().toISOString(),
      channel: "public_order_page",
    };

    await c.env.DB.prepare(
      `UPDATE sales_orders SET status = 'pending_verification',
       payment_evidence_meta_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(JSON.stringify(meta), row.id)
      .run();

    await c.env.DB.prepare(
      `INSERT INTO commerce_events (id, org_id, bot_id, conversation_id, name, meta_json)
       VALUES (?, ?, NULL, '', 'payment.evidence_submitted', ?)`,
    )
      .bind(crypto.randomUUID(), row.org_id, JSON.stringify({ orderId: row.id, ...meta }))
      .run();

    void notifyOwnersPaymentPendingVerification(c.env, row.org_id, {
      publicRef: row.public_ref,
      summary: row.summary,
      subtotalCents: row.subtotal_cents,
      currency: row.currency,
    });

    return json({ ok: true, status: "pending_verification" });
  });
}
