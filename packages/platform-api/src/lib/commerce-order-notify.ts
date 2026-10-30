import type { Env } from "../types";
import { deskEmailConfigured, sendDeskEmail } from "./mail";
import { sendDeskEmailToOrgMembers } from "./notify-org";

export async function notifyOwnersPaymentPendingVerification(
  env: Env,
  orgId: string,
  order: { publicRef: string | null; summary: string; subtotalCents: number; currency: string },
): Promise<void> {
  if (!deskEmailConfigured(env)) return;

  const owners = await env.DB.prepare(
    `SELECT u.email FROM org_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.org_id = ? AND m.role IN ('owner', 'admin')`,
  )
    .bind(orgId)
    .all<{ email: string }>();

  const ref = order.publicRef ?? "pedido";
  const total = `${order.subtotalCents / 100} ${order.currency}`;
  const app = env.APP_URL?.replace(/\/$/, "") ?? "https://desk.rekov.co";
  const text = `Hay un pago por verificar (${ref}).

${order.summary}
Total: ${total}

Revisa y confirma en el panel:
${app}/dashboard/orders`;

  for (const row of owners.results ?? []) {
    if (!row.email?.includes("@")) continue;
    await sendDeskEmail(env, {
      to: row.email,
      subject: `Desk — pago por verificar (${ref})`,
      text,
    });
  }
}

export async function notifyOrderPaymentEvidenceById(
  env: Env,
  orgId: string,
  orderId: string,
): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT public_ref, summary, subtotal_cents, currency FROM sales_orders WHERE id = ? AND org_id = ?`,
  )
    .bind(orderId, orgId)
    .first<{
      public_ref: string | null;
      summary: string;
      subtotal_cents: number;
      currency: string;
    }>();
  if (!row) return;
  await notifyOwnersPaymentPendingVerification(env, orgId, {
    publicRef: row.public_ref,
    summary: row.summary,
    subtotalCents: row.subtotal_cents,
    currency: row.currency,
  });
}

export async function notifyOwnersOrderPaid(
  env: Env,
  orgId: string,
  orderId: string,
): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT public_ref, summary, subtotal_cents, currency FROM sales_orders WHERE id = ? AND org_id = ?`,
  )
    .bind(orderId, orgId)
    .first<{
      public_ref: string | null;
      summary: string;
      subtotal_cents: number;
      currency: string;
    }>();
  if (!row || !deskEmailConfigured(env)) return;

  const ref = row.public_ref ?? orderId.slice(0, 8);
  const total = `${row.subtotal_cents / 100} ${row.currency}`;
  const app = env.APP_URL?.replace(/\/$/, "") ?? "https://desk.rekov.co";
  const text = `Pedido pagado (${ref}).

${row.summary}
Total: ${total}

Detalle en el panel:
${app}/dashboard/orders`;

  await sendDeskEmailToOrgMembers(env, orgId, {
    subject: `Desk — pedido pagado (${ref})`,
    text,
    roles: ["owner", "admin"],
  });
}
