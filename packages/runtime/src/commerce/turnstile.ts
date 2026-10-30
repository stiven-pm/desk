type SiteverifyResponse = {
  success?: boolean;
};

export async function verifyTurnstileToken(
  secret: string | undefined,
  token: string | undefined,
  opts?: { requireConfigured?: boolean },
): Promise<
  | { ok: true }
  | { ok: false; code: "turnstile_required" | "turnstile_failed" | "turnstile_not_configured" }
> {
  const key = secret?.trim();
  if (!key) {
    if (opts?.requireConfigured) {
      return { ok: false, code: "turnstile_not_configured" };
    }
    return { ok: true };
  }
  const trimmed = token?.trim();
  if (!trimmed) return { ok: false, code: "turnstile_required" };

  const form = new URLSearchParams();
  form.set("secret", key);
  form.set("response", trimmed);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  if (!res.ok) return { ok: false, code: "turnstile_failed" };
  const data = (await res.json()) as SiteverifyResponse;
  if (!data.success) return { ok: false, code: "turnstile_failed" };
  return { ok: true };
}
