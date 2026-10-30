import type { Env } from "../types";
import { randomId } from "./http";
import { sendDeskEmail } from "./mail";
import { generateLoginOtp } from "./login-otp";

const TTL_MS = 30 * 60 * 1000;

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toUpperCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function codesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function startEmailChange(
  env: Env,
  input: { userId: string; newEmail: string },
): Promise<{ challengeId: string }> {
  const newEmail = input.newEmail.trim().toLowerCase();

  await env.DB.prepare(
    `DELETE FROM login_challenges WHERE user_id = ? OR expires_at < datetime('now')`,
  )
    .bind(input.userId)
    .run();

  const code = generateLoginOtp();
  const challengeId = randomId();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO login_challenges (id, user_id, email, code_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(challengeId, input.userId, newEmail, await hashCode(code), expiresAt)
    .run();

  await env.DB.prepare(`UPDATE users SET pending_email = ? WHERE id = ?`)
    .bind(newEmail, input.userId)
    .run();

  const sent = await sendDeskEmail(env, {
    to: newEmail,
    subject: "Desk — confirma tu nuevo correo",
    text: `Tu código para confirmar el cambio de correo en Desk es:\n\n${code}\n\nCaduca en 30 minutos.`,
  });
  if (!sent) {
    await env.DB.prepare(`DELETE FROM login_challenges WHERE id = ?`)
      .bind(challengeId)
      .run();
    await env.DB.prepare(`UPDATE users SET pending_email = NULL WHERE id = ?`)
      .bind(input.userId)
      .run();
    throw new Error("otp_email_failed");
  }

  return { challengeId };
}

export async function confirmEmailChange(
  env: Env,
  input: { userId: string; challengeId: string; code: string },
): Promise<{ email: string } | null> {
  const row = await env.DB.prepare(
    `SELECT id, email, code_hash, expires_at FROM login_challenges
     WHERE id = ? AND user_id = ?`,
  )
    .bind(input.challengeId, input.userId)
    .first<{
      id: string;
      email: string;
      code_hash: string;
      expires_at: string;
    }>();

  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) return null;

  const hash = await hashCode(input.code);
  if (!codesMatch(hash, row.code_hash)) return null;

  const newEmail = row.email.trim().toLowerCase();
  const taken = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(newEmail)
    .first();
  if (taken) return null;

  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET email = ?, pending_email = NULL WHERE id = ?`).bind(
      newEmail,
      input.userId,
    ),
    env.DB.prepare(`DELETE FROM login_challenges WHERE id = ?`).bind(row.id),
  ]);

  return { email: newEmail };
}
