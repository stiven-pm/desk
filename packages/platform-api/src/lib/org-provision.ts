import type { Env } from "../types";
import { randomId, periodStartIso } from "./http";
import { generateApiKey } from "./keys";
import { persistDefaultApiKeys } from "../routes/auth";
import { createMemberInvite, type MemberRole } from "./invites";
import { planFromSlug, type PlanSlug, resolveOrgTimezone } from "@chatbot/domain";
import { ensureDeskHostedOrigin } from "./bot-origins";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export async function provisionOrganization(
  env: Env,
  params: {
    name: string;
    adminEmail: string;
    planSlug?: PlanSlug;
    status?: "invited" | "active" | "pending";
    adminRole?: MemberRole;
    invitedByUserId?: string;
    timezone?: string;
  },
): Promise<{
  orgId: string;
  slug: string;
  botId: string;
  invite: { acceptUrl: string; inviteId: string };
}> {
  const orgId = randomId();
  const slug = `${slugify(params.name)}-${orgId.slice(0, 6)}`;
  const period = periodStartIso();
  const plan = planFromSlug(params.planSlug ?? "starter");
  const status = params.status ?? "invited";
  const orgTimezone = resolveOrgTimezone(params.timezone);
  const botId = randomId();
  const pub = generateApiKey("publishable");
  const sec = generateApiKey("secret");

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orgs (id, name, slug, plan_slug, status, period_start, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(orgId, params.name, slug, plan, status, period, orgTimezone),
    env.DB.prepare(
      `INSERT INTO usage_counters (org_id, period_start) VALUES (?, ?)`,
    ).bind(orgId, period),
    env.DB.prepare(
      `INSERT INTO bots (id, org_id, name) VALUES (?, ?, ?)`,
    ).bind(botId, orgId, "Asistente principal"),
  ]);

  await persistDefaultApiKeys(env, orgId, botId, pub.token, sec.token);
  await ensureDeskHostedOrigin(env, botId);

  const invite = await createMemberInvite(env, {
    orgId,
    email: params.adminEmail,
    role: params.adminRole ?? "owner",
    invitedByUserId: params.invitedByUserId,
  });

  await env.DB.prepare(
    `INSERT INTO audit_log (org_id, action, meta_json) VALUES (?, 'org_provisioned', ?)`,
  )
    .bind(
      orgId,
      JSON.stringify({
        admin_email: params.adminEmail,
        invite_id: invite.inviteId,
      }),
    )
    .run();

  return { orgId, slug, botId, invite };
}
