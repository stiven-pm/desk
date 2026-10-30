import type { Env } from "../types";
import { decryptSecret } from "./crypto";

export type DeskWebhookEvent =
  | "conversation.created"
  | "conversation.message"
  | "conversation.handoff"
  | "conversation.closed"
  | "commerce.intent";

export async function emitOrgWebhook(
  env: Env,
  orgId: string,
  event: DeskWebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT id, url, secret_enc, events_json FROM org_event_webhooks
     WHERE org_id = ? AND enabled = 1`,
  )
    .bind(orgId)
    .all<{ id: string; url: string; secret_enc: string | null; events_json: string }>();

  for (const row of rows.results ?? []) {
    let events: string[] = [];
    try {
      events = JSON.parse(row.events_json) as string[];
    } catch {
      continue;
    }
    if (!events.includes(event)) continue;

    let secret = "";
    if (row.secret_enc && env.ENCRYPTION_KEY) {
      secret = (await decryptSecret(row.secret_enc, env.ENCRYPTION_KEY)) ?? "";
    }

    const body = JSON.stringify({
      event,
      orgId,
      at: new Date().toISOString(),
      data: payload,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Desk-Event": event,
    };
    if (secret) {
      const sig = await hmacSha256Hex(secret, body);
      headers["X-Desk-Signature"] = sig;
    }

    try {
      await fetch(row.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // best-effort
    }
  }
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
