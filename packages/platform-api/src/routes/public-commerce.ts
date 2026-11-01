import type { Hono } from "hono";
import { isLegacyPublicOrderRef, parseCommerceManifest } from "@chatbot/domain";
import {
  publicRefSqlBindings,
  publicRefWhereClause,
} from "@chatbot/runtime/commerce/public-ref-db-lookup";
import { z } from "zod";
import type { AppEnv } from "../types";
import { apiError, json } from "../lib/http";
import { clientIp, rateLimitPublic } from "../middleware/rate-limit";
import { notifyOwnersPaymentPendingVerification } from "../lib/commerce-order-notify";
import { reconcilePublicOrderPayment } from "../lib/commerce-public-order-reconcile";
import { hostedChatUrl } from "../lib/bot-web-config";
import { buildCheckoutReturnSearchParams } from "../lib/commerce-checkout-return-query";

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
  conversation_id: string;
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

  const baseSql = `SELECT o.id, o.org_id, o.bot_id, o.conversation_id, o.public_ref, o.public_access_token, o.status,
              o.currency, o.subtotal_cents, o.summary, o.lines_json, o.created_at, c.manifest_json
       FROM sales_orders o
       LEFT JOIN org_commerce_config c ON c.org_id = o.org_id`;

  if (isLegacyPublicOrderRef(trimmed)) {
    const binds = publicRefSqlBindings(trimmed);
    if (binds) {
      const row = await db
        .prepare(
          `${baseSql} WHERE ${publicRefWhereClause("o.public_ref")} ORDER BY o.created_at DESC LIMIT 1`,
        )
        .bind(...binds)
        .first<PublicOrderRow>();
      if (row) return row;
    }
  }

  return db
    .prepare(`${baseSql} WHERE o.public_access_token = ?`)
    .bind(trimmed)
    .first<PublicOrderRow>();
}

function publicOrderUrlPath(row: PublicOrderRow): string {
  return encodeURIComponent(row.public_access_token ?? row.public_ref ?? row.id);
}

function publicOrderAccessKey(row: PublicOrderRow): string {
  return row.public_access_token ?? row.public_ref ?? row.id;
}

async function hostedChatUrlForOrder(
  env: AppEnv["Bindings"],
  row: PublicOrderRow,
): Promise<string | null> {
  const botRow = await env.DB.prepare(
    `SELECT o.slug AS org_slug FROM bots b JOIN orgs o ON o.id = b.org_id
     WHERE b.id = ? AND b.org_id = ?`,
  )
    .bind(row.bot_id, row.org_id)
    .first<{ org_slug: string | null }>();
  const slug = botRow?.org_slug?.trim();
  return slug ? hostedChatUrl(env, slug) : null;
}

/** Parámetro de redirect documentado por Wompi (Widget & Checkout Web, Colombia). */
function wompiReturnTransactionId(search: URLSearchParams): string | null {
  return search.get("id")?.trim() || null;
}

export function registerPublicCommerceRoutes(app: Hono<AppEnv>): void {
  /** Tras pasarela: reconcilia y vuelve al chat web (no a /o/). */
  app.get("/v1/public/orders/:ref/payment-return", async (c) => {
    if (await rateLimitPublic(c.env, `order-return:${clientIp(c.req.raw)}`, 120)) {
      return apiError("rate_limited", 429);
    }

    const ref = c.req.param("ref").trim();
    if (!ref) return apiError("invalid_ref", 400);

    const row = await loadPublicOrderRow(c.env.DB, ref);
    if (!row) return apiError("not_found", 404);

    const incoming = new URL(c.req.url).searchParams;
    const paymentId = incoming.get("paymentId");
    const providerTransactionId = wompiReturnTransactionId(incoming);
    await reconcilePublicOrderPayment(c.env, row, {
      paymentId,
      providerTransactionId,
    });

    const accessKey = publicOrderAccessKey(row);
    const fresh =
      (await loadPublicOrderRow(c.env.DB, accessKey)) ?? row;

    const chatUrl = await hostedChatUrlForOrder(c.env, fresh);
    if (chatUrl) {
      const out = buildCheckoutReturnSearchParams({
        orderAccessKey: publicOrderAccessKey(fresh),
        status: fresh.status,
        publicRef: fresh.public_ref,
        summary: fresh.summary,
        paymentId,
        providerTransactionId,
      });
      return c.redirect(`${chatUrl}?${out.toString()}`, 302);
    }

    const manifest = parseCommerceManifest(row.manifest_json);
    const appBase = publicOrderPageBase(manifest, c.env.APP_URL);
    const out = new URLSearchParams();
    out.set("from_payment", "1");
    if (paymentId) out.set("paymentId", paymentId);
    if (providerTransactionId) out.set("id", providerTransactionId);
    const redirectTarget = `${appBase}/o/${publicOrderUrlPath(row)}?${out.toString()}`;
    return c.redirect(redirectTarget, 302);
  });

  app.post("/v1/public/orders/:ref/reconcile-payment", async (c) => {
    if (
      await rateLimitPublic(
        c.env,
        `order-reconcile:${c.req.param("ref").trim()}:${clientIp(c.req.raw)}`,
        30,
        300,
      )
    ) {
      return apiError("rate_limited", 429);
    }

    const ref = c.req.param("ref").trim();
    if (!ref) return apiError("invalid_ref", 400);

    let paymentId: string | undefined;
    let providerTransactionId: string | undefined;
    try {
      const body = (await c.req.json()) as {
        paymentId?: string;
        providerTransactionId?: string;
        tx?: string;
      };
      paymentId = body.paymentId?.trim();
      providerTransactionId =
        body.providerTransactionId?.trim() ?? body.tx?.trim();
    } catch {
      paymentId = undefined;
      providerTransactionId = undefined;
    }

    const row = await loadPublicOrderRow(c.env.DB, ref);
    if (!row) return apiError("not_found", 404);

    const result = await reconcilePublicOrderPayment(c.env, row, {
      paymentId,
      providerTransactionId,
    });
    const fresh = await loadPublicOrderRow(c.env.DB, ref);
    return json({
      ok: result.ok,
      code: result.code,
      status: fresh?.status ?? row.status,
    });
  });

  app.get("/v1/public/orders/:ref", async (c) => {
    const ref = c.req.param("ref").trim();
    if (
      await rateLimitPublic(
        c.env,
        `order-view:${ref}:${clientIp(c.req.raw)}`,
        120,
      )
    ) {
      return apiError("rate_limited", 429);
    }

    if (!ref) return apiError("invalid_ref", 400);

    const row = await loadPublicOrderRow(c.env.DB, ref);

    if (!row) return apiError("not_found", 404);

    const manifest = parseCommerceManifest(row.manifest_json);
    const appBase = publicOrderPageBase(manifest, c.env.APP_URL);
    const botRow = await c.env.DB.prepare(
      `SELECT o.slug AS org_slug FROM bots b JOIN orgs o ON o.id = b.org_id
       WHERE b.id = ? AND b.org_id = ?`,
    )
      .bind(row.bot_id, row.org_id)
      .first<{ org_slug: string | null }>();
    const chatReturnUrl = botRow?.org_slug?.trim()
      ? hostedChatUrl(c.env, botRow.org_slug.trim())
      : null;
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
