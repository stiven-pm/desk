import { authenticateApiKey } from "./api-key-auth";
import { apiError } from "./http";
import type { Env } from "../types";

function extractApiKey(request: Request): string | null {
  const url = new URL(request.url);
  return (
    request.headers.get("X-Api-Key") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("key") ??
    url.searchParams.get("api_key") ??
    null
  );
}

/** WebSocket público → DO (evita Hono, que rompe respuestas 101). */
export async function proxyPublicConversationWebSocket(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractApiKey(request);
  if (!token) return apiError("unauthorized", 401);
  const keyAuth = await authenticateApiKey(env, token);
  if (!keyAuth || keyAuth.kind !== "publishable") {
    return apiError("unauthorized", 401);
  }

  const url = new URL(request.url);
  const conversationId = url.pathname.split("/").pop()?.trim();
  if (!conversationId) return apiError("not_found", 404);

  const conv = await env.DB.prepare(
    `SELECT org_id FROM conversations WHERE id = ?`,
  )
    .bind(conversationId)
    .first<{ org_id: string }>();
  if (!conv || conv.org_id !== keyAuth.orgId) return apiError("not_found", 404);

  const stub = env.CONVERSATION.getByName(`${conv.org_id}:${conversationId}`);
  const internal = new Request("https://conversation/ws", {
    method: request.method,
    headers: request.headers,
  });
  return stub.fetch(internal);
}
