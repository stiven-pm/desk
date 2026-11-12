import type { Env } from "../types";
import { deskEmailConfigured, sendDeskEmail } from "./mail";

const WELCOME_SENT_ACTION = "onboarding_welcome_sent";
const TRIAL_STARTED_ACTION = "trial_started_email";

async function welcomeAlreadySent(env: Env, orgId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM audit_log WHERE org_id = ? AND action = ? LIMIT 1`,
  )
    .bind(orgId, WELCOME_SENT_ACTION)
    .first();
  return Boolean(row);
}

async function markWelcomeSent(env: Env, orgId: string, meta: Record<string, unknown>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (org_id, action, meta_json) VALUES (?, ?, ?)`,
  )
    .bind(orgId, WELCOME_SENT_ACTION, JSON.stringify(meta))
    .run();
}

function onboardingNotifyInbox(env: Env): string {
  return (env.DESK_ONBOARDING_NOTIFY_EMAIL ?? "contact@rekov.co").trim().toLowerCase();
}

function appBase(env: Env): string {
  return (env.APP_URL ?? "https://desk.rekov.co").replace(/\/$/, "");
}

/** First subscription payment: confirm plan + ask for meeting slots for integration setup. Idempotent. */
export async function sendOnboardingWelcomeEmail(env: Env, orgId: string): Promise<boolean> {
  if (!deskEmailConfigured(env)) {
    console.warn("desk_onboarding_email_skipped", orgId);
    return false;
  }
  if (await welcomeAlreadySent(env, orgId)) return false;

  const row = await env.DB.prepare(
    `SELECT o.name AS org_name, o.slug, o.plan_slug, u.email AS owner_email
     FROM orgs o
     JOIN memberships m ON m.org_id = o.id AND m.role = 'owner'
     JOIN users u ON u.id = m.user_id
     WHERE o.id = ?
     LIMIT 1`,
  )
    .bind(orgId)
    .first<{
      org_name: string;
      slug: string;
      plan_slug: string;
      owner_email: string;
    }>();
  if (!row?.owner_email) return false;

  const contact = onboardingNotifyInbox(env);
  const panelUrl = `${appBase(env)}/dashboard/configuracion?tab=integraciones`;

  const customerText = `Hola,

Tu plan Desk (${row.plan_slug}) ya está activo para ${row.org_name}.

Incluye setup inicial con tus sistemas (API, MCP, conectores o tienda Desk). Para agendar una reunión corta de onboarding, responde a este correo con 2 o 3 franjas horarias (indica tu zona horaria) en los próximos días.

Mientras tanto puedes subir documentos y explorar integraciones en el panel:
${panelUrl}

Si prefieres escribir directo: ${contact}

— Desk / Rekov Systems`;

  const customerOk = await sendDeskEmail(env, {
    to: row.owner_email,
    subject: `Desk confirmado — agenda tu setup de integración`,
    text: customerText,
  });

  const opsText = `Nuevo cliente activo

Org: ${row.org_name} (${row.slug})
Plan: ${row.plan_slug}
Owner: ${row.owner_email}
Org id: ${orgId}

Se envió al cliente la solicitud de franjas horarias para reunión de setup.`;

  await sendDeskEmail(env, {
    to: contact,
    subject: `[Desk] Activo — ${row.org_name}`,
    text: opsText,
  });

  if (customerOk) {
    await markWelcomeSent(env, orgId, {
      to: row.owner_email,
      plan: row.plan_slug,
    });
  }
  return customerOk;
}

/** New registration: 14-day trial started. Idempotent. */
export async function sendTrialStartedEmail(env: Env, orgId: string): Promise<boolean> {
  if (!deskEmailConfigured(env)) {
    console.warn("desk_trial_email_skipped", orgId);
    return false;
  }
  const sent = await env.DB.prepare(
    `SELECT 1 AS ok FROM audit_log WHERE org_id = ? AND action = ? LIMIT 1`,
  )
    .bind(orgId, TRIAL_STARTED_ACTION)
    .first();
  if (sent) return false;

  const row = await env.DB.prepare(
    `SELECT o.name AS org_name, o.slug, o.trial_ends_at, u.email AS owner_email
     FROM orgs o
     JOIN memberships m ON m.org_id = o.id AND m.role = 'owner'
     JOIN users u ON u.id = m.user_id
     WHERE o.id = ?
     LIMIT 1`,
  )
    .bind(orgId)
    .first<{
      org_name: string;
      slug: string;
      trial_ends_at: string | null;
      owner_email: string;
    }>();
  if (!row?.owner_email) return false;

  const contact = onboardingNotifyInbox(env);
  const panelUrl = `${appBase(env)}/dashboard/configuracion?tab=integraciones`;
  const billingUrl = `${appBase(env)}/dashboard/billing`;

  const customerText = `Hola,

Tu prueba de Desk (14 días) ya está activa para ${row.org_name}${row.trial_ends_at ? ` hasta ${row.trial_ends_at.slice(0, 10)}` : ""}.

Incluye setup inicial con tus sistemas. Responde a este correo con 2 o 3 franjas horarias para una reunión corta de onboarding.

Panel: ${panelUrl}
Activar plan de pago cuando quieras: ${billingUrl}

Contacto: ${contact}

— Desk / Rekov Systems`;

  const customerOk = await sendDeskEmail(env, {
    to: row.owner_email,
    subject: `Desk — prueba activa, agenda tu setup`,
    text: customerText,
  });

  await sendDeskEmail(env, {
    to: contact,
    subject: `[Desk] Trial — ${row.org_name}`,
    text: `Trial iniciado\nOrg: ${row.org_name}\nOwner: ${row.owner_email}\nOrg id: ${orgId}`,
  });

  if (customerOk) {
    await env.DB.prepare(
      `INSERT INTO audit_log (org_id, action, meta_json) VALUES (?, ?, ?)`,
    )
      .bind(orgId, TRIAL_STARTED_ACTION, JSON.stringify({ to: row.owner_email }))
      .run();
  }
  return customerOk;
}
