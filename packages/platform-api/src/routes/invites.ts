import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { json, apiError, randomId } from "../lib/http";
import { hashInviteToken } from "../lib/invites";
import { hashPassword, createSessionToken } from "../lib/auth";
import {
  type MemberCapability,
  type MemberRole,
  validateCapabilitySelection,
} from "@chatbot/domain";
import { requireCapability } from "../lib/auth";
import { createMemberInvite } from "../lib/invites";
import { assertSeatAvailable, countOrgSeatUsage } from "../lib/org-seats";
import { PLAN_LIMITS, planFromSlug, resolveMemberCapabilities } from "@chatbot/domain";

export function registerInviteRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/public/invites/:token", async (c) => {
    const tokenHash = await hashInviteToken(c.req.param("token"));
    const invite = await c.env.DB.prepare(
      `SELECT i.email, i.role, i.expires_at, i.accepted_at, o.name as org_name
       FROM member_invites i
       JOIN orgs o ON o.id = i.org_id
       WHERE i.token_hash = ?`,
    )
      .bind(tokenHash)
      .first<{
        email: string;
        role: string;
        expires_at: string;
        accepted_at: string | null;
        org_name: string;
      }>();
    if (!invite) return apiError("invite_not_found", 404);
    if (invite.accepted_at) return apiError("invite_used", 410);
    if (invite.expires_at < new Date().toISOString()) {
      return apiError("invite_expired", 410);
    }
    return json({
      email: invite.email,
      role: invite.role,
      orgName: invite.org_name,
    });
  });

  app.post("/v1/public/invites/:token/accept", async (c) => {
    const rawToken = c.req.param("token");
    const body = (await c.req.json()) as { password?: string };
    if (!body.password || body.password.length < 10) {
      return apiError("invalid_body", 400);
    }

    const tokenHash = await hashInviteToken(rawToken);
    const invite = await c.env.DB.prepare(
      `SELECT id, org_id, email, role, capabilities_json, expires_at, accepted_at
       FROM member_invites WHERE token_hash = ?`,
    )
      .bind(tokenHash)
      .first<{
        id: string;
        org_id: string;
        email: string;
        role: string;
        capabilities_json: string | null;
        expires_at: string;
        accepted_at: string | null;
      }>();

    if (!invite) return apiError("invite_not_found", 404);
    if (invite.accepted_at) return apiError("invite_used", 410);
    if (invite.expires_at < new Date().toISOString()) {
      return apiError("invite_expired", 410);
    }

    let userId: string;
    const existing = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`,
    )
      .bind(invite.email)
      .first<{ id: string }>();

    const passwordHash = await hashPassword(body.password);
    if (existing) {
      userId = existing.id;
      await c.env.DB.prepare(
        `UPDATE users SET password_hash = ? WHERE id = ?`,
      )
        .bind(passwordHash, userId)
        .run();
    } else {
      userId = randomId();
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
      )
        .bind(userId, invite.email, passwordHash)
        .run();
    }

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO memberships (org_id, user_id, role, capabilities_json) VALUES (?, ?, ?, ?)`,
      ).bind(
        invite.org_id,
        userId,
        invite.role,
        invite.capabilities_json,
      ),
      c.env.DB.prepare(
        `UPDATE member_invites SET accepted_at = datetime('now') WHERE id = ?`,
      ).bind(invite.id),
      c.env.DB.prepare(
        `UPDATE orgs SET status = CASE WHEN status = 'invited' THEN 'active' ELSE status END WHERE id = ?`,
      ).bind(invite.org_id),
    ]);

    const capabilities = resolveMemberCapabilities(
      invite.role,
      invite.capabilities_json,
    );
    const session = await createSessionToken(
      {
        id: userId,
        email: invite.email,
        scope: "tenant",
        orgId: invite.org_id,
        role: invite.role,
        capabilities,
      },
      c.env.JWT_SECRET,
    );

    return json({ token: session, orgId: invite.org_id });
  });

  app.get("/v1/admin/activity-log", async (c) => {
    const auth = await requireCapability(c.req.raw, c.env, "team");
    if ("response" in auth) return auth.response;

    const limit = Math.min(
      100,
      Math.max(1, Number(c.req.query("limit") ?? 50) || 50),
    );
    const rows = await c.env.DB.prepare(
      `SELECT a.id, a.action, a.meta_json, a.created_at, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.org_id = ?
       ORDER BY a.id DESC
       LIMIT ?`,
    )
      .bind(auth.user.orgId, limit)
      .all();

    return json({ items: rows.results ?? [] });
  });

  app.get("/v1/admin/members", async (c) => {
    const auth = await requireCapability(c.req.raw, c.env, "team");
    if ("response" in auth) return auth.response;

    const members = await c.env.DB.prepare(
      `SELECT u.id, u.email, m.role, m.capabilities_json, u.created_at
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ?`,
    )
      .bind(auth.user.orgId)
      .all();

    const org = await c.env.DB.prepare(
      `SELECT plan_slug FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();
    const seatCheck = await assertSeatAvailable(
      c.env,
      auth.user.orgId!,
      org?.plan_slug ?? "starter",
    );

    const pending = await c.env.DB.prepare(
      `SELECT id, email, role, capabilities_json, expires_at, created_at
       FROM member_invites
       WHERE org_id = ? AND accepted_at IS NULL`,
    )
      .bind(auth.user.orgId)
      .all();

    const seats = await countOrgSeatUsage(c.env, auth.user.orgId!);
    const limits = PLAN_LIMITS[planFromSlug(org?.plan_slug ?? "starter")];

    return json({
      members: members.results,
      pendingInvites: pending.results,
      seats: { used: seats.total, max: limits.maxSeats },
      seatsAvailable: seatCheck.ok,
    });
  });

  app.post("/v1/admin/members/invite", async (c) => {
    const auth = await requireCapability(c.req.raw, c.env, "team");
    if ("response" in auth) return auth.response;

    const body = (await c.req.json()) as {
      email?: string;
      role?: MemberRole;
      capabilities?: MemberCapability[];
    };
    if (!body.email) return apiError("invalid_body", 400);

    const org = await c.env.DB.prepare(
      `SELECT plan_slug FROM orgs WHERE id = ?`,
    )
      .bind(auth.user.orgId)
      .first<{ plan_slug: string }>();
    const seatCheck = await assertSeatAvailable(
      c.env,
      auth.user.orgId!,
      org?.plan_slug ?? "starter",
    );
    if (!seatCheck.ok) return apiError(seatCheck.code, 403);

    const presetRoles: MemberRole[] = [
      "admin",
      "agent",
      "developer",
      "viewer",
    ];
    let role: MemberRole = "member";
    let capabilities: MemberCapability[] | undefined;

    if (body.capabilities?.length) {
      const valid = validateCapabilitySelection(body.capabilities);
      if (!valid.ok) return apiError(valid.code, 400);
      capabilities = body.capabilities;
      role = "member";
    } else if (body.role && presetRoles.includes(body.role)) {
      role = body.role;
      if (auth.user.role !== "owner" && body.role === "admin") {
        return apiError("forbidden", 403);
      }
    } else {
      return apiError("invalid_body", 400);
    }

    const invite = await createMemberInvite(c.env, {
      orgId: auth.user.orgId!,
      email: body.email,
      role,
      capabilities,
      invitedByUserId: auth.user.id,
    });

    return json({
      inviteUrl: invite.acceptUrl,
      inviteId: invite.inviteId,
      emailSent: true,
    });
  });
}
