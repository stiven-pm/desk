import type { MemberCapability, MemberRole } from "@chatbot/domain";
import { serializeCapabilities } from "@chatbot/domain";
import type { Env } from "../types";
import { randomId } from "./http";
import { sendInviteEmail } from "./mail";

export type { MemberRole };

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateInviteToken(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createMemberInvite(
  env: Env,
  params: {
    orgId: string;
    email: string;
    role: MemberRole;
    capabilities?: MemberCapability[];
    invitedByUserId?: string;
    ttlHours?: number;
  },
): Promise<{ inviteId: string; token: string; acceptUrl: string }> {
  const token = generateInviteToken();
  const tokenHash = await hashInviteToken(token);
  const inviteId = randomId();
  const ttlHours = params.ttlHours ?? 48;
  const expires = new Date(
    Date.now() + ttlHours * 60 * 60 * 1000,
  ).toISOString();

  const capabilitiesJson =
    params.capabilities?.length
      ? serializeCapabilities(params.capabilities)
      : null;

  await env.DB.prepare(
    `INSERT INTO member_invites (id, org_id, email, role, capabilities_json, token_hash, invited_by_user_id, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      inviteId,
      params.orgId,
      params.email.toLowerCase(),
      params.role,
      capabilitiesJson,
      tokenHash,
      params.invitedByUserId ?? null,
      expires,
    )
    .run();

  const appUrl = env.APP_URL?.trim();
  if (!appUrl) throw new Error("APP_URL is not configured");
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;

  const org = await env.DB.prepare(`SELECT name FROM orgs WHERE id = ?`)
    .bind(params.orgId)
    .first<{ name: string }>();

  await sendInviteEmail(env, {
    to: params.email,
    orgName: org?.name ?? "Desk",
    acceptUrl,
    role: params.role,
  });

  return { inviteId, token, acceptUrl };
}
