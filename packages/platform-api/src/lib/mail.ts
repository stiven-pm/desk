import type { Env } from "../types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function deskEmailConfigured(env: Env): boolean {
  return Boolean(env.EMAIL?.send && env.DESK_FROM_EMAIL?.trim());
}

export async function sendDeskEmailMany(
  env: Env,
  input: { to: string[]; subject: string; text: string },
): Promise<number> {
  let n = 0;
  for (const to of input.to) {
    if (await sendDeskEmail(env, { to, subject: input.subject, text: input.text })) n += 1;
  }
  return n;
}

export async function sendDeskEmail(
  env: Env,
  input: { to: string; subject: string; text: string },
): Promise<boolean> {
  const html = `<div style="font-family:sans-serif;line-height:1.5"><p>${escapeHtml(input.text).replace(/\n/g, "<br/>")}</p></div>`;
  const from = env.DESK_FROM_EMAIL?.trim() ?? "";
  if (!from || !env.EMAIL?.send) {
    console.warn("desk_email_skipped", input.subject, input.to);
    return false;
  }

  try {
    await env.EMAIL.send({
      to: input.to,
      from: { email: from, name: "Desk" },
      subject: input.subject,
      text: input.text,
      html,
    });
    return true;
  } catch (e) {
    console.error("desk_cf_email_failed", e);
    return false;
  }
}

export async function sendInviteEmail(
  env: Env,
  params: { to: string; orgName: string; acceptUrl: string; role: string },
): Promise<boolean> {
  const text = `Te invitaron a Desk (${params.orgName}) como ${params.role}.

Activa tu cuenta aquí (48 h):
${params.acceptUrl}

Si no esperabas este correo, ignóralo.`;

  return sendDeskEmail(env, {
    to: params.to,
    subject: `Invitación a Desk — ${params.orgName}`,
    text,
  });
}
