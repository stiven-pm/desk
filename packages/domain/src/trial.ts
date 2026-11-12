export const TRIAL_DURATION_DAYS = 14;

/** ISO timestamp when a new trial ends (UTC). */
export function trialEndsAtIso(from = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + TRIAL_DURATION_DAYS);
  return d.toISOString();
}

export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return true;
  return Date.now() >= Date.parse(trialEndsAt);
}

/** Visitor chat + panel APIs (paid or trial not expired). */
export function orgServiceActive(
  status: string,
  trialEndsAt?: string | null,
): boolean {
  if (status === "active") return true;
  if (status === "trial" && trialEndsAt && !isTrialExpired(trialEndsAt)) return true;
  return false;
}

export const TRIAL_MARKETING_LINE =
  "Prueba 14 días gratis: panel, chat, documentos e integraciones con cupos reducidos (1 asiento). Sin tarjeta al registrarte.";
