import type { Env } from "../types";
import { randomId } from "./http";
import { sendDeskEmail } from "./mail";

const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const OTP_LEN = 8;
const OTP_TTL_MS = 10 * 60 * 1000;

export function generateLoginOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(OTP_LEN));
  let out = "";
  for (let i = 0; i < OTP_LEN; i++) {
    out += OTP_ALPHABET[bytes[i]! % OTP_ALPHABET.length];
  }
  return out;
}

async function hashLoginOtp(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toUpperCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function otpHashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createPasswordLoginChallenge(
  env: Env,
  input: { userId: string; email: string },
): Promise<{ challenge_id: string }> {
  await env.DB.prepare(
    `DELETE FROM login_challenges WHERE email = ? OR expires_at < datetime('now')`,
  )
    .bind(input.email)
    .run();

  const code = generateLoginOtp();
  const challengeId = randomId();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO login_challenges (id, user_id, email, code_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(challengeId, input.userId, input.email, await hashLoginOtp(code), expiresAt)
    .run();

  const sent = await sendDeskEmail(env, {
    to: input.email,
    subject: "Desk — código de inicio de sesión",
    text: `Tu código para entrar a Desk es:\n\n${code}\n\nCaduca en 10 minutos. Si no fuiste tú, ignora este correo.`,
  });
  if (!sent) {
    await env.DB.prepare(`DELETE FROM login_challenges WHERE id = ?`)
      .bind(challengeId)
      .run();
    throw new Error("otp_email_failed");
  }

  return { challenge_id: challengeId };
}

export async function consumePasswordLoginChallenge(
  env: Env,
  input: { challengeId: string; email: string; code: string },
): Promise<{ userId: string } | null> {
  const row = await env.DB.prepare(
    `SELECT id, user_id, code_hash, expires_at FROM login_challenges
     WHERE id = ? AND email = ?`,
  )
    .bind(input.challengeId, input.email)
    .first<{
      id: string;
      user_id: string;
      code_hash: string;
      expires_at: string;
    }>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM login_challenges WHERE id = ?`)
      .bind(row.id)
      .run();
    return null;
  }
  const hash = await hashLoginOtp(input.code);
  if (!otpHashesMatch(row.code_hash, hash)) return null;

  await env.DB.prepare(`DELETE FROM login_challenges WHERE id = ?`)
    .bind(row.id)
    .run();
  return { userId: row.user_id };
}
