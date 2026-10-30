import type { Env } from "../types";
import { randomId } from "./http";
import { generateApiKey, hashApiKey } from "./keys";

export async function getPublishableKeyPlain(
  env: Env,
  botId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT token_plain FROM api_keys
     WHERE bot_id = ? AND kind = 'publishable' AND revoked_at IS NULL
     ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(botId)
    .first<{ token_plain: string | null }>();
  return row?.token_plain ?? null;
}

export async function rotatePublishableKey(
  env: Env,
  orgId: string,
  botId: string,
): Promise<string> {
  const pub = generateApiKey("publishable");
  await env.DB.prepare(
    `UPDATE api_keys SET revoked_at = datetime('now')
     WHERE bot_id = ? AND kind = 'publishable' AND revoked_at IS NULL`,
  )
    .bind(botId)
    .run();
  await env.DB.prepare(
    `INSERT INTO api_keys (id, org_id, bot_id, kind, key_prefix, key_hash, label, token_plain)
     VALUES (?, ?, ?, 'publishable', ?, ?, 'default', ?)`,
  )
    .bind(
      randomId(),
      orgId,
      botId,
      pub.token.slice(0, 12),
      await hashApiKey(pub.token),
      pub.token,
    )
    .run();
  return pub.token;
}
