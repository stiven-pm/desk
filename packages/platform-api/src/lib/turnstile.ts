import type { Env } from "../types";

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(
  env: Env,
  token: string | undefined,
  remoteIp: string | null,
): Promise<{ ok: true } | { ok: false; code: "turnstile_required" | "turnstile_failed" | "turnstile_not_configured" }> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const production = env.CHATBOT_ENV === "production";
  if (!secret) {
    if (production) return { ok: false, code: "turnstile_not_configured" };
    return { ok: true };
  }

  const trimmed = token?.trim();
  if (!trimmed) return { ok: false, code: "turnstile_required" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", trimmed);
  if (remoteIp) form.set("remoteip", remoteIp);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  if (!res.ok) return { ok: false, code: "turnstile_failed" };

  const data = (await res.json()) as SiteverifyResponse;
  if (!data.success) return { ok: false, code: "turnstile_failed" };
  return { ok: true };
}

export function publicTurnstileSiteKey(env: Env): string | null {
  const key = env.TURNSTILE_SITE_KEY?.trim();
  return key || null;
}
