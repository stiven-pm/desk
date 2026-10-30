import type { Env } from "../types";
import { checkoutReturnBaseUrl } from "./creem";
import { randomId } from "./http";
import { sendDeskEmail } from "./mail";

const MAGIC_TTL_MS = 15 * 60 * 1000;

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendMagicLoginLink(
  env: Env,
  input: { userId: string; email: string },
): Promise<boolean> {
  const token = `${randomId()}${randomId()}`.replace(/-/g, "");
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS).toISOString();

  await env.DB.prepare(
    `DELETE FROM magic_login_tokens WHERE user_id = ? OR expires_at < datetime('now')`,
  )
    .bind(input.userId)
    .run();

  await env.DB.prepare(
    `INSERT INTO magic_login_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(randomId(), input.userId, await hashToken(token), expiresAt)
    .run();

  const base = checkoutReturnBaseUrl(env);
  const link = `${base}/login?magic=${encodeURIComponent(token)}`;

  return sendDeskEmail(env, {
    to: input.email,
    subject: "Tu enlace de acceso — Desk",
    text: `Entra a Desk con este enlace (válido 15 minutos):\n${link}\n\nSi no lo pediste, ignora este correo.`,
  });
}

async function findMagicLoginRow(
  env: Env,
  token: string,
): Promise<{ id: string; user_id: string; expires_at: string } | null> {
  const hash = await hashToken(token.trim());
  const row = await env.DB.prepare(
    `SELECT id, user_id, expires_at FROM magic_login_tokens WHERE token_hash = ?`,
  )
    .bind(hash)
    .first<{ id: string; user_id: string; expires_at: string }>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM magic_login_tokens WHERE id = ?`)
      .bind(row.id)
      .run();
    return null;
  }
  return row;
}

/** Validates token without deleting (e.g. org pick step). */
export async function peekMagicLoginToken(
  env: Env,
  token: string,
): Promise<{ userId: string; rowId: string } | null> {
  const row = await findMagicLoginRow(env, token);
  if (!row) return null;
  return { userId: row.user_id, rowId: row.id };
}

export async function revokeMagicLoginToken(env: Env, rowId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM magic_login_tokens WHERE id = ?`).bind(rowId).run();
}

export async function consumeMagicLoginToken(
  env: Env,
  token: string,
): Promise<{ userId: string } | null> {
  const row = await findMagicLoginRow(env, token);
  if (!row) return null;
  await revokeMagicLoginToken(env, row.id);
  return { userId: row.user_id };
}
