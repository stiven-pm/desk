import { parseOpenApiSpec } from "@chatbot/runtime/integrations/openapi";
import { randomId } from "./http";

export async function syncOpenApiTools(
  db: D1Database,
  botId: string,
  configId: string,
  specRaw: string,
): Promise<{ count: number; error?: string }> {
  const parsed = parseOpenApiSpec(specRaw);
  if (parsed.error) return { count: 0, error: parsed.error };

  await db
    .prepare(
      `DELETE FROM bot_http_tools WHERE bot_id = ? AND openapi_config_id = ?`,
    )
    .bind(botId, configId)
    .run();

  let count = 0;
  for (const t of parsed.tools.slice(0, 40)) {
    await db
      .prepare(
        `INSERT INTO bot_http_tools (id, bot_id, name, description, method, path, parameters_json, source, openapi_config_id, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'openapi', ?, 1)`,
      )
      .bind(
        randomId(),
        botId,
        t.name,
        t.description,
        t.method,
        t.path,
        JSON.stringify(t.parameters),
        configId,
      )
      .run();
    count++;
  }
  return { count };
}
