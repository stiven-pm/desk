import type { Env } from "../types";

/** Chat en APP_URL ya está permitido en `isPublicOriginAllowed`; no lo mezclamos con dominios del cliente. */
export async function ensureDeskHostedOrigin(
  _env: Env,
  _botId: string,
): Promise<void> {
  /* no-op */
}
