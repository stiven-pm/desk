import type { Hono } from "hono";
import {
  registerBodySchema,
  loginBodySchema,
  resolveMemberCapabilities,
  resolveOrgTimezone,
} from "@chatbot/domain";
import type { AppEnv, Env } from "../types";
import {
  createSessionToken,
  hashPassword,
  signupsOpen,
  verifyPassword,
} from "../lib/auth";
import { recordOrgAudit } from "../lib/org-audit";
import { json, randomId, periodStartIso, apiError } from "../lib/http";
import { generateApiKey, hashApiKey } from "../lib/keys";
import { clientIp, rateLimitPublic } from "../middleware/rate-limit";
import { ensureDeskHostedOrigin } from "../lib/bot-origins";
import { loginStepUpRequired } from "../lib/login-otp-policy";
import {
  consumePasswordLoginChallenge,
  createPasswordLoginChallenge,
} from "../lib/login-otp";
import {
  peekMagicLoginToken,
  revokeMagicLoginToken,
  sendMagicLoginLink,
} from "../lib/magic-login";
import { assertTenantLoginAllowed } from "./admin-account";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function registerAuthRoutes(app: Hono<AppEnv>): void {
  app.post("/v1/admin/auth/register", async (c) => {
    if (!signupsOpen(c.env)) return apiError("signup_closed", 403);

    const ip = clientIp(c.req.raw);
    if (await rateLimitPublic(c.env, `reg:${ip}`, 10, 3600)) {
      return apiError("rate_limited", 429);
    }

    const parsed = registerBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    const email = parsed.data.email.trim().toLowerCase();
    const { password, orgName } = parsed.data;
    const orgTimezone = resolveOrgTimezone(parsed.data.timezone);
    const userId = randomId();
    const orgId = randomId();
    const slug = `${slugify(orgName)}-${userId.slice(0, 6)}`;
    const passwordHash = await hashPassword(password);
    const period = periodStartIso();

    const existing = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`,
    )
      .bind(email)
      .first();
    if (existing) return apiError("email_taken", 409);

    const botId = randomId();
    const pub = generateApiKey("publishable");
    const sec = generateApiKey("secret");

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
      ).bind(userId, email, passwordHash),
      c.env.DB.prepare(
        `INSERT INTO orgs (id, name, slug, status, period_start, timezone) VALUES (?, ?, ?, 'pending', ?, ?)`,
      ).bind(orgId, orgName, slug, period, orgTimezone),
      c.env.DB.prepare(
        `INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')`,
      ).bind(orgId, userId),
      c.env.DB.prepare(
        `INSERT INTO usage_counters (org_id, period_start) VALUES (?, ?)`,
      ).bind(orgId, period),
      c.env.DB.prepare(
        `INSERT INTO bots (id, org_id, name) VALUES (?, ?, ?)`,
      ).bind(botId, orgId, "Asistente principal"),
    ]);

    await persistDefaultApiKeys(c.env, orgId, botId, pub.token, sec.token);
    await ensureDeskHostedOrigin(c.env, botId);

    const token = await createSessionToken(
      { id: userId, email, scope: "tenant", orgId, role: "owner" },
      c.env.JWT_SECRET,
    );

    return json({
      token,
      org: { id: orgId, slug, status: "pending" },
      defaultBotId: botId,
      apiKeys: {
        publishable: pub.token,
        secret: sec.token,
      },
    });
  });

  app.post("/v1/admin/auth/login", async (c) => {
    const ip = clientIp(c.req.raw);
    if (await rateLimitPublic(c.env, `login:${ip}`, 30, 3600)) {
      return apiError("rate_limited", 429);
    }

    const body = (await c.req.json()) as {
      email?: string;
      password?: string;
      orgId?: string;
    };
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) return apiError("invalid_body", 400);

    const email = parsed.data.email.trim().toLowerCase();

    const account = await c.env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE email = ?`,
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();

    if (!account) return apiError("invalid_credentials", 401);
    const ok = await verifyPassword(parsed.data.password, account.password_hash);
    if (!ok) return apiError("invalid_credentials", 401);

    if (loginStepUpRequired(c.env, email)) {
      try {
        const { challenge_id } = await createPasswordLoginChallenge(c.env, {
          userId: account.id,
          email: account.email,
        });
        return json({
          requires_otp: true,
          challenge_id,
          email: account.email,
          message: "Te enviamos un código al correo. Introdúcelo para entrar.",
        });
      } catch (e) {
        console.error("login_otp_send_failed", e);
        return apiError("otp_email_failed", 503);
      }
    }

    return finishTenantLogin(c, account, body.orgId);
  });

  app.post("/v1/admin/auth/login/verify-otp", async (c) => {
    const ip = clientIp(c.req.raw);
    if (await rateLimitPublic(c.env, `login-otp:${ip}`, 20, 3600)) {
      return apiError("rate_limited", 429);
    }

    const body = (await c.req.json()) as {
      email?: string;
      password?: string;
      challenge_id?: string;
      code?: string;
      orgId?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const challengeId = body.challenge_id?.trim() ?? "";
    const code = body.code?.trim() ?? "";
    if (!email || !password || !challengeId || !code) {
      return apiError("email_password_and_otp_required", 400);
    }

    const consumed = await consumePasswordLoginChallenge(c.env, {
      challengeId,
      email,
      code,
    });
    if (!consumed) return apiError("invalid_otp", 401);

    const account = await c.env.DB.prepare(
      `SELECT id, email, password_hash FROM users WHERE email = ?`,
    )
      .bind(email)
      .first<{ id: string; email: string; password_hash: string }>();
    if (!account || account.id !== consumed.userId) {
      return apiError("invalid_credentials", 401);
    }
    const pwdOk = await verifyPassword(password, account.password_hash);
    if (!pwdOk) return apiError("invalid_credentials", 401);

    return finishTenantLogin(c, account, body.orgId);
  });

  app.post("/v1/admin/auth/magic-link", async (c) => {
    const ip = clientIp(c.req.raw);
    if (await rateLimitPublic(c.env, `magic:${ip}`, 8, 3600)) {
      return apiError("rate_limited", 429);
    }

    const body = (await c.req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return apiError("email_required", 400);

    const account = await c.env.DB.prepare(`SELECT id, email FROM users WHERE email = ?`)
      .bind(email)
      .first<{ id: string; email: string }>();
    if (account) {
      await sendMagicLoginLink(c.env, {
        userId: account.id,
        email: account.email,
      });
    }

    return json({
      ok: true,
      message: "Si la cuenta existe, enviamos un enlace de acceso a tu correo.",
    });
  });

  app.post("/v1/admin/auth/magic-consume", async (c) => {
    const body = (await c.req.json()) as { token?: string; orgId?: string };
    const token = body.token?.trim();
    if (!token) return apiError("invalid_body", 400);

    const peeked = await peekMagicLoginToken(c.env, token);
    if (!peeked) return apiError("invalid_token", 401);

    const account = await c.env.DB.prepare(`SELECT id, email FROM users WHERE id = ?`)
      .bind(peeked.userId)
      .first<{ id: string; email: string }>();
    if (!account) return apiError("invalid_credentials", 401);

    const outcome = await resolveTenantLogin(c, account, body.orgId);
    if (outcome.kind === "session") {
      await revokeMagicLoginToken(c.env, peeked.rowId);
    }
    return tenantLoginResponse(outcome);
  });
}

type TenantLoginOutcome =
  | { kind: "error"; code: string; status: number }
  | {
      kind: "pick";
      orgs: { id: string; name: string; slug: string; role: string }[];
    }
  | { kind: "session"; token: string; orgId: string };

function tenantLoginResponse(outcome: TenantLoginOutcome): Response {
  if (outcome.kind === "error") {
    return apiError(outcome.code, outcome.status);
  }
  if (outcome.kind === "pick") {
    return json({ needOrgPick: true, orgs: outcome.orgs });
  }
  return json({ token: outcome.token, orgId: outcome.orgId });
}

async function resolveTenantLogin(
  c: { env: Env },
  account: { id: string; email: string },
  orgIdHint?: string,
): Promise<TenantLoginOutcome> {
  const memberships = await c.env.DB.prepare(
    `SELECT m.org_id, m.role, m.capabilities_json, o.name as org_name, o.slug
     FROM memberships m
     JOIN orgs o ON o.id = m.org_id
     WHERE m.user_id = ?
       AND o.deletion_scheduled_at IS NULL`,
  )
    .bind(account.id)
    .all<{
      org_id: string;
      role: string;
      capabilities_json: string | null;
      org_name: string;
      slug: string;
    }>();

  if (!memberships.results.length) {
    return { kind: "error", code: "no_org_membership", status: 403 };
  }

  const pick =
    orgIdHint ??
    (memberships.results.length === 1
      ? memberships.results[0].org_id
      : undefined);

  if (!pick) {
    return {
      kind: "pick",
      orgs: memberships.results.map((m) => ({
        id: m.org_id,
        name: m.org_name,
        slug: m.slug,
        role: m.role,
      })),
    };
  }

  const membership = memberships.results.find((m) => m.org_id === pick);
  if (!membership) return { kind: "error", code: "invalid_org", status: 400 };

  const loginAllowed = await assertTenantLoginAllowed(c.env, membership.org_id);
  if (!loginAllowed.ok) {
    return { kind: "error", code: loginAllowed.code, status: 403 };
  }

  const capabilities = resolveMemberCapabilities(
    membership.role,
    membership.capabilities_json,
  );
  const token = await createSessionToken(
    {
      id: account.id,
      email: account.email,
      scope: "tenant",
      orgId: membership.org_id,
      role: membership.role,
      capabilities,
    },
    c.env.JWT_SECRET,
  );

  void recordOrgAudit(c.env, membership.org_id, account.id, "auth.login", {
    email: account.email,
    role: membership.role,
  });

  return { kind: "session", token, orgId: membership.org_id };
}

async function finishTenantLogin(
  c: { env: Env },
  account: { id: string; email: string },
  orgIdHint?: string,
) {
  return tenantLoginResponse(await resolveTenantLogin(c, account, orgIdHint));
}

export async function persistDefaultApiKeys(
  env: Env,
  orgId: string,
  botId: string,
  publishable: string,
  secret: string,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO api_keys (id, org_id, bot_id, kind, key_prefix, key_hash, label, token_plain)
       VALUES (?, ?, ?, 'publishable', ?, ?, 'default', ?)`,
    ).bind(
      randomId(),
      orgId,
      botId,
      publishable.slice(0, 12),
      await hashApiKey(publishable),
      publishable,
    ),
    env.DB.prepare(
      `INSERT INTO api_keys (id, org_id, bot_id, kind, key_prefix, key_hash, label)
       VALUES (?, ?, ?, 'secret', ?, ?, 'default')`,
    ).bind(
      randomId(),
      orgId,
      botId,
      secret.slice(0, 12),
      await hashApiKey(secret),
    ),
  ]);
}
