/** Resume same chat after reload / short absence. */
export const VISITOR_SESSION_IDLE_MINUTES = 15;

/** Warn in the chat before the session expires (minutes before idle cutoff). */
export const VISITOR_SESSION_IDLE_WARN_MINUTES = 3;

/** Shown in hosted chat when the bot has no custom idle reply configured. */
export const VISITOR_SESSION_IDLE_WARN_DEFAULT =
  "Llevamos un rato sin actividad. Si no respondes, reiniciaremos el chat.";

/** @deprecated Use VISITOR_SESSION_IDLE_MINUTES; kept for API field compatibility. */
export const VISITOR_SESSION_IDLE_HOURS = VISITOR_SESSION_IDLE_MINUTES / 60;

/** Hard cap: do not resume threads older than this (days). */
export const VISITOR_SESSION_MAX_AGE_DAYS = 7;

/** Auto-close automated chats with no activity this long (server cron). */
export const VISITOR_AUTOCLOSE_IDLE_MINUTES = VISITOR_SESSION_IDLE_MINUTES;

/** @deprecated Use VISITOR_AUTOCLOSE_IDLE_MINUTES */
export const VISITOR_AUTOCLOSE_IDLE_HOURS = VISITOR_AUTOCLOSE_IDLE_MINUTES / 60;

export function visitorSessionIdleSqlOffset(): string {
  return `-${VISITOR_SESSION_IDLE_MINUTES} minutes`;
}

export function visitorAutocloseIdleSqlOffset(): string {
  return `-${VISITOR_AUTOCLOSE_IDLE_MINUTES} minutes`;
}

export type VisitorSessionContext = {
  timezone?: string;
  /** Local wall-clock time for the visitor (ISO-ish). */
  localIso?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
};

export function formatVisitorSessionForPrompt(ctx: VisitorSessionContext): string {
  const lines: string[] = [];
  if (ctx.localIso) {
    lines.push(
      `Fecha y hora local del visitante (referencia del sistema): ${ctx.localIso}`,
    );
  } else if (ctx.timezone) {
    lines.push(`Zona horaria del visitante: ${ctx.timezone}`);
  }
  const place = [ctx.city, ctx.region, ctx.country].filter(Boolean).join(", ");
  if (place) lines.push(`Ubicación aproximada: ${place}`);
  if (!lines.length) return "";
  return `## Contexto de sesión
${lines.join("\n")}
- Para calendario y "hoy", usa la fecha/hora de arriba; responde en una frase.
- No expliques arquitectura (internet, reloj, modelo). Si no aplica al negocio, redirige con cortesía.`;
}
