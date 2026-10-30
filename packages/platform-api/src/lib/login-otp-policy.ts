import type { Env } from "../types";
import { deskEmailConfigured } from "./mail";

/** Solo desarrollo local: `LOGIN_OTP_SKIP=true` en el Worker. */
export function loginOtpBypassAllowed(env: Env): boolean {
  return (env.LOGIN_OTP_SKIP ?? "").toLowerCase() === "true";
}

function otpBypassEmails(env: Env): Set<string> {
  const raw = env.LOGIN_OTP_BYPASS_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Cuentas listadas en LOGIN_OTP_BYPASS_EMAILS (p. ej. revisor Meta): solo contraseña. */
export function loginOtpBypassForEmail(env: Env, email: string): boolean {
  return otpBypassEmails(env).has(email.trim().toLowerCase());
}

export function loginStepUpRequired(env: Env, email?: string): boolean {
  if (loginOtpBypassAllowed(env)) return false;
  if (email && loginOtpBypassForEmail(env, email)) return false;
  return deskEmailConfigured(env);
}
