import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import {
  hashPassword,
  requireAdminRole,
  requireUser,
  verifyPassword,
} from "../lib/auth";
import { apiError, json } from "../lib/http";
import {
  buildOrgSlugFromName,
  stableSlugSuffix,
} from "../lib/org-slug";
import {
  confirmEmailChange,
  startEmailChange,
} from "../lib/account-email-change";
import {
  deletionGraceDays,
  orgDeletionBlocksLogin,
  scheduleOrgDeletion,
} from "../lib/account-deletion";
import { invalidateBotCache } from "../lib/tenant-cache";

async function uniqueOrgSlug(
  env: AppEnv["Bindings"],
  candidate: string,
  excludeOrgId: string,
): Promise<string | null> {
  let slug = candidate;
  for (let i = 0; i < 8; i++) {
    const row = await env.DB.prepare(
      `SELECT id FROM orgs WHERE slug = ? AND id != ?`,
    )
      .bind(slug, excludeOrgId)
      .first();
    if (!row) return slug;
    slug = `${candidate.slice(0, 58)}-${i + 2}`;
  }
  return null;
}

export function registerAdminAccountRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/admin/account", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const org = await c.env.DB.prepare(
      `SELECT id, name, slug, deletion_scheduled_at FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{
        id: string;
        name: string;
        slug: string;
        deletion_scheduled_at: string | null;
      }>();

    const user = await c.env.DB.prepare(
      `SELECT email, pending_email FROM users WHERE id = ?`,
    )
      .bind(auth.user.id)
      .first<{ email: string; pending_email: string | null }>();

    return json({
      user: {
        email: user?.email ?? auth.user.email,
        pendingEmail: user?.pending_email ?? null,
      },
      org: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            deletionScheduledAt: org.deletion_scheduled_at,
          }
        : null,
      deletionGraceDays: deletionGraceDays(),
    });
  });

  app.patch("/v1/admin/account/org", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner", "admin"]);
    if ("response" in auth) return auth.response;

    const parsed = z
      .object({ name: z.string().trim().min(2).max(120) })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const current = await c.env.DB.prepare(
      `SELECT name, slug FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ name: string; slug: string }>();
    if (!current) return apiError("not_found", 404);

    const suffix = stableSlugSuffix(current.slug);
    const candidate = buildOrgSlugFromName(parsed.data.name, suffix);
    const slug = await uniqueOrgSlug(c.env, candidate, auth.user.orgId!);
    if (!slug) return apiError("slug_unavailable", 409);

    await c.env.DB.prepare(
      `UPDATE orgs SET name = ?, slug = ? WHERE id = ?`,
    )
      .bind(parsed.data.name, slug, auth.user.orgId)
      .run();

    const bots = await c.env.DB.prepare(`SELECT id FROM bots WHERE org_id = ?`)
      .bind(auth.user.orgId)
      .all<{ id: string }>();
    for (const b of bots.results ?? []) {
      await invalidateBotCache(c.env, b.id);
    }

    return json({
      ok: true,
      org: { name: parsed.data.name, slug },
    });
  });

  app.post("/v1/admin/account/change-password", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const parsed = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(10).max(200),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const row = await c.env.DB.prepare(
      `SELECT password_hash FROM users WHERE id = ?`,
    )
      .bind(auth.user.id)
      .first<{ password_hash: string }>();
    if (!row) return apiError("not_found", 404);

    const ok = await verifyPassword(
      parsed.data.currentPassword,
      row.password_hash,
    );
    if (!ok) return apiError("invalid_credentials", 401);

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .bind(passwordHash, auth.user.id)
      .run();

    return json({ ok: true });
  });

  app.post("/v1/admin/account/change-email", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const parsed = z
      .object({
        newEmail: z.string().email(),
        currentPassword: z.string().min(1),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const newEmail = parsed.data.newEmail.trim().toLowerCase();
    const row = await c.env.DB.prepare(
      `SELECT password_hash, email FROM users WHERE id = ?`,
    )
      .bind(auth.user.id)
      .first<{ password_hash: string; email: string }>();
    if (!row) return apiError("not_found", 404);

    if (newEmail === row.email) return apiError("email_unchanged", 400);

    const pwdOk = await verifyPassword(
      parsed.data.currentPassword,
      row.password_hash,
    );
    if (!pwdOk) return apiError("invalid_credentials", 401);

    const taken = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(newEmail)
      .first();
    if (taken) return apiError("email_taken", 409);

    try {
      const { challengeId } = await startEmailChange(c.env, {
        userId: auth.user.id,
        newEmail,
      });
      return json({
        ok: true,
        challengeId,
        message: "Te enviamos un código al nuevo correo.",
      });
    } catch {
      return apiError("otp_email_failed", 503);
    }
  });

  app.post("/v1/admin/account/change-email/verify", async (c) => {
    const auth = await requireUser(c.req.raw, c.env);
    if ("response" in auth) return auth.response;

    const parsed = z
      .object({
        challengeId: z.string().min(1),
        code: z.string().min(4).max(32),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const result = await confirmEmailChange(c.env, {
      userId: auth.user.id,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
    });
    if (!result) return apiError("invalid_otp", 401);

    return json({ ok: true, email: result.email });
  });

  app.post("/v1/admin/account/delete", async (c) => {
    const auth = await requireAdminRole(c.req.raw, c.env, ["owner"]);
    if ("response" in auth) return auth.response;

    const parsed = z
      .object({
        currentPassword: z.string().min(1),
        confirmPhrase: z.literal("ELIMINAR"),
      })
      .safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const row = await c.env.DB.prepare(
      `SELECT password_hash FROM users WHERE id = ?`,
    )
      .bind(auth.user.id)
      .first<{ password_hash: string }>();
    if (!row) return apiError("not_found", 404);

    const pwdOk = await verifyPassword(
      parsed.data.currentPassword,
      row.password_hash,
    );
    if (!pwdOk) return apiError("invalid_credentials", 401);

    const purgeAt = await scheduleOrgDeletion(c.env, auth.user.orgId!);
    return json({
      ok: true,
      purgeAt,
      message:
        "Cuenta programada para eliminación. No podrás iniciar sesión durante el periodo de gracia.",
    });
  });
}

export async function assertTenantLoginAllowed(
  env: AppEnv["Bindings"],
  orgId: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const block = await orgDeletionBlocksLogin(env, orgId);
  if (!block.blocked) return { ok: true };

  const stillExists = await env.DB.prepare(`SELECT id FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first();
  if (!stillExists) return { ok: false, code: "account_deleted" };

  return { ok: false, code: "account_deletion_pending" };
}
