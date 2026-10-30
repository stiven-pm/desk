import { decryptSecret, encryptSecret } from "./crypto";
import { siigoAuthenticate, siigoTokenNeedsRefresh } from "./siigo";

/** Renueva JWT de Siigo antes de cargar herramientas del agente. */
export async function ensureSiigoTokensFresh(
  db: D1Database,
  botId: string,
  encryptionKey?: string,
): Promise<void> {
  if (!encryptionKey) return;

  const row = await db
    .prepare(
      `SELECT id, config_enc FROM bot_connectors
       WHERE bot_id = ? AND connector_key = 'siigo' AND enabled = 1`,
    )
    .bind(botId)
    .first<{ id: string; config_enc: string }>();
  if (!row) return;

  const plain = await decryptSecret(row.config_enc, encryptionKey);
  if (!plain) return;

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(plain) as Record<string, unknown>;
  } catch {
    return;
  }

  if (!siigoTokenNeedsRefresh(config)) return;

  const username = String(config.username ?? "").trim();
  const accessKey = String(config.accessKey ?? "").trim();
  const partnerId = String(config.partnerId ?? "").trim();
  if (!username || !accessKey || !partnerId) return;

  try {
    const { accessToken, expiresAt } = await siigoAuthenticate({
      username,
      accessKey,
      partnerId,
    });
    config = {
      ...config,
      accessToken,
      tokenExpiresAt: expiresAt,
      partnerId,
    };
    const configEnc = await encryptSecret(JSON.stringify(config), encryptionKey);
    const tokenEnc = await encryptSecret(accessToken, encryptionKey);

    await db
      .prepare(
        `UPDATE bot_connectors SET config_enc = ?, status = 'connected', updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(configEnc, row.id)
      .run();

    await db
      .prepare(
        `UPDATE bot_http_tools SET auth_secret_enc = ?
         WHERE bot_id = ? AND base_url = 'https://api.siigo.com' AND enabled = 1`,
      )
      .bind(tokenEnc, botId)
      .run();
  } catch {
    await db
      .prepare(
        `UPDATE bot_connectors SET status = 'error', last_error = 'siigo_auth_failed', updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(row.id)
      .run();
  }
}
