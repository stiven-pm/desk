import type { Env, ApiKeyAuth } from "../types";
import { hashApiKey, isPublishableKey, isSecretKey } from "./keys";

export async function authenticateApiKey(
  env: Env,
  token: string,
): Promise<ApiKeyAuth | null> {
  if (!isPublishableKey(token) && !isSecretKey(token)) return null;
  const keyHash = await hashApiKey(token);
  const row = await env.DB.prepare(
    `SELECT id, org_id, bot_id, kind FROM api_keys
     WHERE key_hash = ? AND revoked_at IS NULL`,
  )
    .bind(keyHash)
    .first<{
      id: string;
      org_id: string;
      bot_id: string | null;
      kind: "publishable" | "secret";
    }>();
  if (!row) return null;
  return {
    orgId: row.org_id,
    botId: row.bot_id,
    kind: row.kind,
    keyId: row.id,
  };
}
