import type { Env } from "../types";
import { deskEmailConfigured, sendDeskEmail } from "./mail";

export type OrgNotifyRole = "owner" | "admin" | "agent";

/** Correos de miembros del equipo (como alertas de operador: todos los que atienden). */
export async function listOrgMemberEmails(
  env: Env,
  orgId: string,
  roles: OrgNotifyRole[] = ["owner", "admin"],
): Promise<string[]> {
  const placeholders = roles.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT DISTINCT u.email FROM org_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.org_id = ? AND m.role IN (${placeholders}) AND u.email LIKE '%@%'`,
  )
    .bind(orgId, ...roles)
    .all<{ email: string }>();

  const out: string[] = [];
  for (const row of rows.results ?? []) {
    const e = row.email?.trim().toLowerCase();
    if (e && !out.includes(e)) out.push(e);
  }
  return out;
}

/** Cloudflare Email: un envío por destinatario (no hay multi-To en un solo send). */
export async function sendDeskEmailToOrgMembers(
  env: Env,
  orgId: string,
  input: { subject: string; text: string; roles?: OrgNotifyRole[] },
): Promise<number> {
  if (!deskEmailConfigured(env)) return 0;
  const emails = await listOrgMemberEmails(env, orgId, input.roles);
  let sent = 0;
  for (const to of emails) {
    const ok = await sendDeskEmail(env, { to, subject: input.subject, text: input.text });
    if (ok) sent += 1;
  }
  return sent;
}

export async function notifyOwnersHumanHandoff(
  env: Env,
  params: {
    orgId: string;
    conversationId: string;
    customerHint: string;
    summary: string;
  },
): Promise<void> {
  const app = env.APP_URL?.replace(/\/$/, "") ?? "";
  const text = `Un cliente pidió atención humana en el chat.

${params.customerHint}
Resumen: ${params.summary}

Bandeja:
${app}/dashboard/panel

Conversación: ${params.conversationId}`;

  await sendDeskEmailToOrgMembers(env, params.orgId, {
    subject: "Cliente espera respuesta en la bandeja",
    text,
    roles: ["owner", "admin", "agent"],
  });
}
