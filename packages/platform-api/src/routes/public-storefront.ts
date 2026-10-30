import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { apiError, json } from "../lib/http";
import { clientIp, rateLimitPublic } from "../middleware/rate-limit";
import {
  hostedChatUrl,
  hostedStorefrontUrl,
} from "../lib/bot-web-config";
import { loadPublicChatByOrgSlug } from "../lib/public-chat-resolve";
import { listPublishedProductsForOrgSlug } from "../lib/public-storefront-products";
import { publicTurnstileSiteKey } from "../lib/turnstile";
import { requirePublishableBot } from "../lib/public-api-key";
import { ensurePublicConversationDo } from "../lib/public-conversation";
import {
  loadOrgCommerceManifest,
  storefrontBuyerSteps,
} from "../lib/org-commerce-manifest";

async function loadConversationForAuth(
  env: AppEnv["Bindings"],
  conversationId: string,
  orgId: string,
  botId: string,
): Promise<{ id: string; phase: string } | null> {
  return env.DB.prepare(
    `SELECT id, phase FROM conversations
     WHERE id = ? AND org_id = ? AND bot_id = ?`,
  )
    .bind(conversationId, orgId, botId)
    .first<{ id: string; phase: string }>();
}

export function registerPublicStorefrontRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/public/storefront/:orgSlug", async (c) => {
    if (await rateLimitPublic(c.env, `store-boot:${clientIp(c.req.raw)}`, 120)) {
      return apiError("rate_limited", 429);
    }
    const slug = c.req.param("orgSlug").trim();
    if (!slug) return apiError("invalid_slug", 400);

    const loaded = await loadPublicChatByOrgSlug(c.env, slug);
    if (!loaded.ok) {
      if (loaded.error === "inactive") return apiError("org_inactive", 403);
      if (loaded.error === "publishable_key_missing") {
        return apiError("publishable_key_missing", 503);
      }
      return apiError("not_found", 404);
    }

    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM products p
       JOIN orgs o ON o.id = p.org_id
       WHERE o.slug = ? AND p.status = 'published'`,
    )
      .bind(slug)
      .first<{ n: number }>();

    const { publishableKey, ...rest } = loaded.data;
    const orgRow = await c.env.DB.prepare(`SELECT id FROM orgs WHERE slug = ?`)
      .bind(slug)
      .first<{ id: string }>();
    const manifest = orgRow
      ? await loadOrgCommerceManifest(c.env, orgRow.id)
      : null;
    return json({
      ...rest,
      chatUrl: hostedChatUrl(c.env, slug),
      storefrontUrl: hostedStorefrontUrl(c.env, slug),
      publishedProductCount: countRow?.n ?? 0,
      publishableKeyPrefix: publishableKey.slice(0, 12),
      publishableKey,
      turnstileSiteKey: publicTurnstileSiteKey(c.env),
      buyerSteps: manifest ? storefrontBuyerSteps(manifest) : undefined,
    });
  });

  app.get("/v1/public/storefront/:orgSlug/products", async (c) => {
    if (await rateLimitPublic(c.env, `store-products:${clientIp(c.req.raw)}`, 120)) {
      return apiError("rate_limited", 429);
    }
    const slug = c.req.param("orgSlug").trim();
    if (!slug) return apiError("invalid_slug", 400);

    const { listStorefrontCatalogForSlug } = await import(
      "../lib/catalog-capabilities"
    );
    const listed = await listStorefrontCatalogForSlug(c.env, slug, 100);
    if (!listed.ok) {
      if (listed.error === "inactive") return apiError("org_inactive", 403);
      return apiError("not_found", 404);
    }

    return json({ products: listed.products });
  });

  app.get("/v1/public/conversations/:conversationId/commerce/cart", async (c) => {
    if (await rateLimitPublic(c.env, `cart-get:${clientIp(c.req.raw)}`, 60)) {
      return apiError("rate_limited", 429);
    }
    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const conversationId = c.req.param("conversationId");
    const row = await loadConversationForAuth(
      c.env,
      conversationId,
      gate.bot.orgId,
      gate.bot.botId,
    );
    if (!row) return apiError("not_found", 404);

    await ensurePublicConversationDo(c.env, gate.bot, conversationId);

    const stub = c.env.CONVERSATION.getByName(
      `${gate.bot.orgId}:${conversationId}`,
    );
    const res = await stub.fetch(new Request("http://do/commerce/cart", { method: "GET" }));
    const data = await res.json();
    return json(data, res.status as 200);
  });

  app.post("/v1/public/conversations/:conversationId/commerce/cart", async (c) => {
    if (await rateLimitPublic(c.env, `cart-post:${clientIp(c.req.raw)}`, 40)) {
      return apiError("rate_limited", 429);
    }
    const gate = await requirePublishableBot(c);
    if (!gate.ok) return gate.response;

    const conversationId = c.req.param("conversationId");
    const row = await loadConversationForAuth(
      c.env,
      conversationId,
      gate.bot.orgId,
      gate.bot.botId,
    );
    if (!row) return apiError("not_found", 404);

    const body = await c.req.json();
    await ensurePublicConversationDo(c.env, gate.bot, conversationId);

    const stub = c.env.CONVERSATION.getByName(
      `${gate.bot.orgId}:${conversationId}`,
    );
    const res = await stub.fetch(
      new Request("http://do/commerce/cart", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    const data = await res.json();
    return json(data, res.status as 200);
  });

  const publicBuyerBodySchema = z.object({
    type: z.enum(["natural_person", "company"]).optional(),
    name: z.string().max(200).optional(),
    email: z.string().max(200).optional(),
    phone: z.string().max(40).optional(),
    documentId: z.string().max(80).optional(),
    companyName: z.string().max(200).optional(),
    taxId: z.string().max(80).optional(),
    city: z.string().max(120).optional(),
    address: z.string().max(400).optional(),
    notes: z.string().max(500).optional(),
    consentAccepted: z.boolean().optional(),
  });

  app.post(
    "/v1/public/conversations/:conversationId/commerce/buyer",
    async (c) => {
      if (await rateLimitPublic(c.env, `buyer:${clientIp(c.req.raw)}`, 40)) {
        return apiError("rate_limited", 429);
      }
      const gate = await requirePublishableBot(c);
      if (!gate.ok) return gate.response;

      const parsed = publicBuyerBodySchema.safeParse(await c.req.json());
      if (!parsed.success) return apiError("invalid_body", 400);

      const conversationId = c.req.param("conversationId");
      const row = await loadConversationForAuth(
        c.env,
        conversationId,
        gate.bot.orgId,
        gate.bot.botId,
      );
      if (!row) return apiError("not_found", 404);

      await ensurePublicConversationDo(c.env, gate.bot, conversationId);

      const stub = c.env.CONVERSATION.getByName(
        `${gate.bot.orgId}:${conversationId}`,
      );
      const res = await stub.fetch(
        new Request("http://do/commerce/buyer", {
          method: "POST",
          body: JSON.stringify({
            type: "natural_person",
            ...parsed.data,
          }),
        }),
      );
      const data = await res.json();
      return json(data, res.status as 200);
    },
  );

  app.post(
    "/v1/public/conversations/:conversationId/commerce/start-checkout",
    async (c) => {
      if (await rateLimitPublic(c.env, `checkout:${clientIp(c.req.raw)}`, 20)) {
        return apiError("rate_limited", 429);
      }
      const gate = await requirePublishableBot(c);
      if (!gate.ok) return gate.response;

      const conversationId = c.req.param("conversationId");
      const row = await loadConversationForAuth(
        c.env,
        conversationId,
        gate.bot.orgId,
        gate.bot.botId,
      );
      if (!row) return apiError("not_found", 404);

      const checkoutBodySchema = z.object({
        idempotencyKey: z.string().max(128).optional(),
        confirmPriceChange: z.boolean().optional(),
        confirmCartChange: z.boolean().optional(),
        turnstileToken: z.string().max(4096).optional(),
      });

      let rawBody: unknown = {};
      try {
        rawBody = await c.req.json();
      } catch {
        rawBody = {};
      }
      const parsedBody = checkoutBodySchema.safeParse(rawBody);
      const confirmPriceChange =
        parsedBody.success && parsedBody.data.confirmPriceChange === true;
      const confirmCartChange =
        parsedBody.success && parsedBody.data.confirmCartChange === true;
      const turnstileToken =
        parsedBody.success ? parsedBody.data.turnstileToken?.trim() : undefined;

      await ensurePublicConversationDo(c.env, gate.bot, conversationId);

      const headerIdempotency =
        c.req.header("Idempotency-Key")?.trim().slice(0, 128) || undefined;
      const idempotencyKey =
        (parsedBody.success ? parsedBody.data.idempotencyKey?.trim() : undefined) ||
        headerIdempotency;

      const stub = c.env.CONVERSATION.getByName(
        `${gate.bot.orgId}:${conversationId}`,
      );
      const res = await stub.fetch(
        new Request("http://do/commerce/start-checkout", {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey,
            confirmPriceChange,
            confirmCartChange,
            turnstileToken,
          }),
        }),
      );
      const data = await res.json();
      return json(data, res.ok ? 200 : 400);
    },
  );
}
