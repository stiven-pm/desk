import type { Hono } from "hono";
import {
  createBotBodySchema,
  planFromSlug,
  PLAN_MARKETING,
  type PlanSlug,
  updateBotBodySchema,
} from "@chatbot/domain";
import type { AppEnv } from "../types";
import { requireUser, requireAdminRole } from "../lib/auth";
import {
  createSourceUpload,
  deleteDocumentSource,
  reindexBotSources,
} from "../lib/ingest";
import { json, apiError, randomId } from "../lib/http";
import { PLAN_LIMITS } from "@chatbot/domain";
import { getUsage } from "../lib/usage";
import { countOrgSeatUsage } from "../lib/org-seats";
import {
  checkoutSuccessUrl,
  createCreemCheckout,
  resolveCreemProductId,
  resolveCreemWalletProductId,
} from "../lib/creem";
import {
  syncPaidCheckoutToPending,
  type PendingPaymentRow,
} from "../lib/fulfill-payment";
import { WALLET_CREDIT_PACKS, type WalletPackId } from "@chatbot/domain";
import { persistDefaultApiKeys } from "./auth";
import { generateApiKey } from "../lib/keys";
import { invalidateBotCache } from "../lib/tenant-cache";
import { ensureDeskHostedOrigin } from "../lib/bot-origins";
import { resolveMemberCapabilities } from "@chatbot/domain";
import { resolveChatModel } from "@chatbot/runtime/llm-client";
import { loadMembershipAccess } from "../lib/auth";
import { normalizeVisitorPhone } from "../lib/visitor-phone";

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/me", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const org = await c.env.DB.prepare(
      `SELECT id, name, slug, plan_slug, status FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first();
    const planSlug = planFromSlug((org as { plan_slug?: string })?.plan_slug ?? "starter");
    const { getUsageWithWallet } = await import("../lib/usage");
    const billing = await getUsageWithWallet(c.env, auth.user.orgId, planSlug);
    const limits = PLAN_LIMITS[planSlug];
    const seats = await countOrgSeatUsage(c.env, auth.user.orgId);
    const access = await loadMembershipAccess(
      c.env,
      auth.user.orgId!,
      auth.user.id,
    );
    const capabilities = resolveMemberCapabilities(
      access?.role ?? auth.user.role ?? "member",
      access?.capabilitiesJson,
    );
    return json({
      user: {
        ...auth.user,
        role: access?.role ?? auth.user.role,
        capabilities,
      },
      org,
      usage: billing.usage,
      meteredCredits: billing.metered,
      walletBalance: billing.wallet,
      limits,
      seats: { used: seats.total, max: limits.maxSeats },
    });
  });

  app.get("/v1/admin/billing/plan-change-preview", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const targetRaw = c.req.query("targetPlan");
    if (!targetRaw) return apiError("invalid_body", 400);

    const org = await c.env.DB.prepare(
      `SELECT plan_slug FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();

    const currentSlug = planFromSlug(org?.plan_slug ?? "starter");
    if (!["starter", "growth", "business"].includes(targetRaw)) {
      return apiError("invalid_plan", 400);
    }
    const targetSlug = planFromSlug(targetRaw) as PlanSlug;

    const currentLimits = PLAN_LIMITS[currentSlug];
    const targetLimits = PLAN_LIMITS[targetSlug];
    const usage = await getUsage(c.env, auth.user.orgId!);
    const seats = await countOrgSeatUsage(c.env, auth.user.orgId);

    const currentPrice =
      PLAN_MARKETING.find((p) => p.slug === currentSlug)?.priceUsd ?? 0;
    const targetPrice =
      PLAN_MARKETING.find((p) => p.slug === targetSlug)?.priceUsd ?? 0;
    const isDowngrade = targetPrice < currentPrice;

    const warnings: string[] = [];
    if (usage.messagesCount > targetLimits.monthlyMessages) {
      warnings.push(
        `Mensajes este mes (${usage.messagesCount}) superan el tope del plan nuevo (${targetLimits.monthlyMessages}).`,
      );
    }
    if (usage.aiCreditsUsed > targetLimits.monthlyAiCredits) {
      warnings.push(
        `Créditos usados (${usage.aiCreditsUsed}) superan el cupo del plan nuevo (${targetLimits.monthlyAiCredits}).`,
      );
    }
    if (seats.total > targetLimits.maxSeats) {
      warnings.push(
        `Tienes ${seats.total} usuarios en el panel; el plan nuevo permite ${targetLimits.maxSeats}.`,
      );
    }

    return json({
      currentPlan: currentSlug,
      targetPlan: targetSlug,
      isDowngrade,
      effectiveNote: isDowngrade
        ? "La bajada de plan suele aplicarse al siguiente ciclo de facturación. Los datos históricos se conservan; algunas funciones pueden quedar restringidas."
        : "El upgrade se aplica al confirmar el pago en Creem.",
      warnings,
      limits: [
        {
          key: "monthlyMessages",
          label: "Mensajes de clientes / mes",
          current: currentLimits.monthlyMessages,
          target: targetLimits.monthlyMessages,
        },
        {
          key: "monthlyAiCredits",
          label: "Créditos de procesamiento / mes",
          current: currentLimits.monthlyAiCredits,
          target: targetLimits.monthlyAiCredits,
        },
        {
          key: "maxSeats",
          label: "Usuarios del panel",
          current: currentLimits.maxSeats,
          target: targetLimits.maxSeats,
        },
      ],
      billingNote:
        isDowngrade
          ? "Revisa el ajuste de facturación y créditos no consumidos en el checkout o con soporte Rekov antes de confirmar."
          : null,
    });
  });

  app.post("/v1/admin/bots", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const parsed = createBotBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM bots WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 1) return apiError("plan_bot_limit", 403);

    const botId = randomId();
    await c.env.DB.prepare(
      `INSERT INTO bots (id, org_id, name, system_prompt, model)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        botId,
        auth.user.orgId,
        parsed.data.name,
        parsed.data.systemPrompt ?? "",
        resolveChatModel(c.env),
      )
      .run();

    const pub = generateApiKey("publishable");
    const sec = generateApiKey("secret");
    await persistDefaultApiKeys(c.env, auth.user.orgId, botId, pub.token, sec.token);
    await ensureDeskHostedOrigin(c.env, botId);

    return json({ botId, apiKeys: { publishable: pub.token, secret: sec.token } });
  });

  app.get("/v1/admin/bots", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const bots = await c.env.DB.prepare(
      `SELECT id, name, model, created_at FROM bots WHERE org_id = ? ORDER BY created_at DESC`,
    )
      .bind(auth.user.orgId)
      .all();
    return json({ bots: bots.results });
  });

  app.get("/v1/admin/bots/:botId", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const bot = await c.env.DB.prepare(
      `SELECT id, name, model, system_prompt, theme_css_url, host_components_json, created_at,
              welcome_message, closing_message, idle_reply_message
       FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.user.orgId)
      .first<{
        id: string;
        name: string;
        model: string;
        system_prompt: string;
        theme_css_url: string | null;
        host_components_json: string | null;
        created_at: string;
        welcome_message: string | null;
        closing_message: string | null;
        idle_reply_message: string | null;
      }>();
    if (!bot) return apiError("not_found", 404);

    return json({
      bot: {
        id: bot.id,
        name: bot.name,
        model: bot.model,
        systemPrompt: bot.system_prompt,
        welcomeMessage: bot.welcome_message,
        closingMessage: bot.closing_message,
        idleReplyMessage: bot.idle_reply_message,
        createdAt: bot.created_at,
      },
    });
  });

  app.patch("/v1/admin/bots/:botId", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const botId = c.req.param("botId");
    const parsed = updateBotBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const existing = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.user.orgId)
      .first();
    if (!existing) return apiError("not_found", 404);

    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.name !== undefined) {
      fields.push("name = ?");
      values.push(parsed.data.name);
    }
    if (parsed.data.systemPrompt !== undefined) {
      fields.push("system_prompt = ?");
      values.push(parsed.data.systemPrompt);
    }
    if (parsed.data.model !== undefined) {
      fields.push("model = ?");
      values.push(parsed.data.model);
    }
    if (parsed.data.themeCssUrl !== undefined) {
      fields.push("theme_css_url = ?");
      values.push(parsed.data.themeCssUrl);
    }
    if (parsed.data.hostComponents !== undefined) {
      fields.push("host_components_json = ?");
      values.push(JSON.stringify(parsed.data.hostComponents));
    }
    if (parsed.data.welcomeMessage !== undefined) {
      fields.push("welcome_message = ?");
      values.push(parsed.data.welcomeMessage);
    }
    if (parsed.data.closingMessage !== undefined) {
      fields.push("closing_message = ?");
      values.push(parsed.data.closingMessage);
    }
    if (parsed.data.idleReplyMessage !== undefined) {
      fields.push("idle_reply_message = ?");
      values.push(parsed.data.idleReplyMessage);
    }
    if (fields.length === 0) return apiError("invalid_body", 400);

    values.push(botId, auth.user.orgId);
    await c.env.DB.prepare(
      `UPDATE bots SET ${fields.join(", ")} WHERE id = ? AND org_id = ?`,
    )
      .bind(...values)
      .run();

    await invalidateBotCache(c.env, botId);
    return json({ ok: true });
  });

  app.get("/v1/admin/documents", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const botId = c.req.query("botId");
    const stmt = botId
      ? c.env.DB.prepare(
          `SELECT id, bot_id, title, description, document_filename, status, kind, created_at, updated_at, error_message
           FROM sources WHERE org_id = ? AND bot_id = ? ORDER BY updated_at DESC LIMIT 100`,
        ).bind(auth.user.orgId, botId)
      : c.env.DB.prepare(
          `SELECT id, bot_id, title, description, document_filename, status, kind, created_at, updated_at, error_message
           FROM sources WHERE org_id = ? ORDER BY updated_at DESC LIMIT 100`,
        ).bind(auth.user.orgId);
    const rows = await stmt.all();
    return json({ documents: rows.results });
  });

  app.post("/v1/admin/documents", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const form = await c.req.formData();
    const botId = String(form.get("botId") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const file = form.get("file");
    if (!botId || !title || !(file instanceof File)) {
      return apiError("invalid_body", 400);
    }

    if (title === "Conexiones y credenciales") {
      return apiError(
        "use_integrations_for_secrets",
        400,
        undefined,
        "Los tokens y URLs van en Capacidades o Integraciones (cifrados). No los subas como documento.",
      );
    }

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.user.orgId)
      .first();
    if (!bot) return apiError("not_found", 404);

    const org = await c.env.DB.prepare(
      `SELECT plan_slug FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();
    const limits = PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];
    const srcCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM sources WHERE org_id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ n: number }>();
    if ((srcCount?.n ?? 0) >= limits.maxRagSources) {
      return apiError("plan_rag_limit", 403);
    }

    const idempotencyKey =
      c.req.header("Idempotency-Key") ??
      `doc-${auth.user.orgId}-${crypto.randomUUID()}`;

    const buf = await file.arrayBuffer();
    const result = await createSourceUpload(c.env, {
      orgId: auth.user.orgId!,
      botId,
      title,
      description,
      documentFilename: file.name,
      contentType: file.type || "application/octet-stream",
      body: buf,
      idempotencyKey,
    });

    return json({ ...result, status: "indexing" });
  });

  app.post("/v1/admin/documents/reindex-bot", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const body = (await c.req.json()) as { botId?: string };
    const botId = body.botId?.trim();
    if (!botId) return apiError("invalid_body", 400);

    const bot = await c.env.DB.prepare(
      `SELECT id FROM bots WHERE id = ? AND org_id = ?`,
    )
      .bind(botId, auth.user.orgId)
      .first();
    if (!bot) return apiError("not_found", 404);

    const queued = await reindexBotSources(c.env, botId, auth.user.orgId!);
    return json({ ok: true, queued });
  });

  app.patch("/v1/admin/documents/:sourceId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const sourceId = c.req.param("sourceId");
    const body = (await c.req.json()) as {
      title?: string;
      description?: string;
    };
    const title = body.title?.trim();
    const description = body.description?.trim();
    if (!title && description === undefined) {
      return apiError("invalid_body", 400);
    }

    const row = await c.env.DB.prepare(
      `SELECT id FROM sources WHERE id = ? AND org_id = ?`,
    )
      .bind(sourceId, auth.user.orgId)
      .first();
    if (!row) return apiError("not_found", 404);

    if (title) {
      await c.env.DB.prepare(
        `UPDATE sources SET title = ?, name = ?, updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(title, title, sourceId)
        .run();
    }
    if (description !== undefined) {
      await c.env.DB.prepare(
        `UPDATE sources SET description = ?, updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(description, sourceId)
        .run();
    }
    return json({ ok: true });
  });

  app.delete("/v1/admin/documents/:sourceId", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, [
      "owner",
      "admin",
      "developer",
    ]);
    if ("response" in auth) return auth.response;

    const sourceId = c.req.param("sourceId");
    const ok = await deleteDocumentSource(c.env, sourceId, auth.user.orgId!);
    if (!ok) return apiError("not_found", 404);
    return json({ ok: true });
  });

  app.get("/v1/admin/billing/wallet", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const org = await c.env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();
    const planSlug = planFromSlug(org?.plan_slug ?? "starter");
    const { getUsageWithWallet } = await import("../lib/usage");
    const { WALLET_CREDIT_PACKS } = await import("@chatbot/domain");
    const data = await getUsageWithWallet(c.env, auth.user.orgId!, planSlug);
    return json({
      balanceCredits: data.wallet,
      meteredCredits: data.metered,
      usage: data.usage,
      limits: data.limits,
      packs: WALLET_CREDIT_PACKS,
    });
  });

  app.post("/v1/admin/billing/checkout", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { plan?: string };
    const plan = planFromSlug(body.plan ?? "starter");
    const productId = resolveCreemProductId(c.env, plan);
    if (!productId) return apiError("billing_not_configured", 503);

    const reference = `DESK-${randomId().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

    let checkout;
    try {
      checkout = await createCreemCheckout(c.env, {
        productId,
        requestId: reference,
        successUrl: checkoutSuccessUrl(
          c.env,
          `/billing/success?ref=${encodeURIComponent(reference)}`,
        ),
        customerEmail: auth.user.email,
      });
    } catch (e) {
      console.error("desk_checkout_failed", e);
      return apiError("checkout_unavailable", 503);
    }

    await c.env.DB.prepare(
      `INSERT INTO pending_payments (id, org_id, creem_checkout_id, plan_slug, reference, payment_kind)
       VALUES (?, ?, ?, ?, ?, 'subscription')`,
    )
      .bind(randomId(), auth.user.orgId, checkout.id, plan, reference)
      .run();

    return json({
      checkoutId: checkout.id,
      url: checkout.checkout_url,
      reference,
    });
  });

  app.post("/v1/admin/billing/wallet/checkout", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { pack?: string };
    const pack = body.pack as WalletPackId;
    if (!pack || !(pack in WALLET_CREDIT_PACKS)) {
      return apiError("invalid_pack", 400);
    }

    const org = await c.env.DB.prepare(`SELECT status, plan_slug FROM orgs WHERE id = ?`)
      .bind(auth.user.orgId)
      .first<{ status: string; plan_slug: string }>();
    if (org?.status !== "active") {
      return apiError("subscription_required", 402);
    }

    const productId = resolveCreemWalletProductId(c.env, pack);
    if (!productId) return apiError("billing_not_configured", 503);

    const reference = `DESK-W-${randomId().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    let checkout;
    try {
      checkout = await createCreemCheckout(c.env, {
        productId,
        requestId: reference,
        successUrl: checkoutSuccessUrl(
          c.env,
          `/billing/success?ref=${encodeURIComponent(reference)}&kind=wallet`,
        ),
        customerEmail: auth.user.email,
      });
    } catch (e) {
      console.error("desk_wallet_checkout_failed", e);
      return apiError("checkout_unavailable", 503);
    }

    await c.env.DB.prepare(
      `INSERT INTO pending_payments (id, org_id, creem_checkout_id, plan_slug, reference, payment_kind, wallet_pack)
       VALUES (?, ?, ?, ?, ?, 'wallet', ?)`,
    )
      .bind(
        randomId(),
        auth.user.orgId,
        checkout.id,
        org!.plan_slug,
        reference,
        pack,
      )
      .run();

    return json({
      checkoutId: checkout.id,
      url: checkout.checkout_url,
      reference,
      pack,
    });
  });

  app.get("/v1/admin/billing/payment-status", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const ref = c.req.query("ref")?.trim();
    if (!ref) return apiError("reference_required", 400);

    let payment = await c.env.DB.prepare(
      `SELECT id, org_id, creem_checkout_id, plan_slug, status, reference,
              payment_kind, wallet_pack
       FROM pending_payments
       WHERE reference = ? AND org_id = ?`,
    )
      .bind(ref, auth.user.orgId!)
      .first<PendingPaymentRow>();

    if (!payment) return apiError("payment_not_found", 404);

    if (payment.status !== "paid" && payment.creem_checkout_id) {
      try {
        await syncPaidCheckoutToPending(c.env, payment);
        payment = await c.env.DB.prepare(
          `SELECT id, org_id, creem_checkout_id, plan_slug, status, reference,
                  payment_kind, wallet_pack
           FROM pending_payments WHERE id = ?`,
        )
          .bind(payment.id)
          .first<PendingPaymentRow>() as PendingPaymentRow;
      } catch (e) {
        console.error("desk_payment_status_sync_failed", e);
      }
    }

    const org = await c.env.DB.prepare(
      `SELECT status, plan_slug FROM orgs WHERE id = ?`,
    )
      .bind(payment!.org_id)
      .first<{ status: string; plan_slug: string }>();

    const isWallet = payment!.payment_kind === "wallet";
    const paid = isWallet
      ? payment!.status === "paid"
      : org?.status === "active" || payment!.status === "paid";

    return json({
      reference: ref,
      status: paid ? "paid" : payment!.status,
      payment_kind: payment!.payment_kind,
      wallet_pack: payment!.wallet_pack,
      org_status: org?.status ?? "unknown",
      plan_slug: org?.plan_slug ?? payment!.plan_slug,
    });
  });

  app.get("/v1/admin/handoff-settings", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin", "agent"]);
    if ("response" in auth) return auth.response;
    const row = await c.env.DB.prepare(
      `SELECT handoff_dial_code, handoff_phone FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ handoff_dial_code: string | null; handoff_phone: string | null }>();
    const dialCode = row?.handoff_dial_code ?? null;
    const phoneNumber = row?.handoff_phone ?? null;
    return json({
      dialCode,
      phoneNumber,
      configured: Boolean(dialCode && phoneNumber),
    });
  });

  app.patch("/v1/admin/handoff-settings", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;
    const body = (await c.req.json()) as { dialCode?: string; phoneNumber?: string };
    const normalized = normalizeVisitorPhone(
      body.dialCode ?? "",
      body.phoneNumber ?? "",
    );
    if (!normalized) return apiError("invalid_body", 400);
    await c.env.DB.prepare(
      `UPDATE orgs SET handoff_dial_code = ?, handoff_phone = ? WHERE id = ?`,
    )
      .bind(normalized.dialCode, normalized.phone, auth.user.orgId)
      .run();
    return json({
      dialCode: normalized.dialCode,
      phoneNumber: normalized.phone,
      configured: true,
    });
  });
}
