import { upsertOpenApiConfigSchema } from "@chatbot/domain";
import { encryptSecret } from "./crypto";
import { randomId } from "./http";
import { syncOpenApiTools } from "./integration-openapi";
import type { Env } from "../types";
import {
  assertPublicHttpsUrl,
  isOpenApiSpecUrlAllowed,
} from "./setup-agent-ssrf";

export async function importOpenApiFromUrl(
  env: Env,
  params: {
    botId: string;
    specUrl: string;
    baseUrl: string;
    authType?: "none" | "bearer" | "header";
    authHeaderName?: string;
    authSecret?: string;
  },
): Promise<
  | { ok: true; configId: string; toolsSynced: number; error?: string }
  | { ok: false; error: string }
> {
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (!encKey) return { ok: false, error: "encryption_not_configured" };

  const parsedBase = upsertOpenApiConfigSchema.safeParse({
    baseUrl: params.baseUrl,
    spec: "{}",
    authType: params.authType ?? "none",
    authHeaderName: params.authHeaderName,
    authSecret: params.authSecret,
  });
  if (!parsedBase.success) return { ok: false, error: "invalid_base_url" };

  let specUrl: URL;
  try {
    specUrl = assertPublicHttpsUrl(params.specUrl);
    if (!isOpenApiSpecUrlAllowed(specUrl)) {
      return { ok: false, error: "spec_url_not_allowed" };
    }
  } catch {
    return { ok: false, error: "invalid_spec_url" };
  }

  let specStr: string;
  try {
    const res = await fetch(specUrl.toString(), {
      signal: AbortSignal.timeout(25_000),
      headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
    });
    if (!res.ok) {
      return { ok: false, error: `spec_fetch_http_${res.status}` };
    }
    specStr = (await res.text()).slice(0, 2_000_000);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "spec_fetch_failed",
    };
  }

  let authSecretEnc: string | null = null;
  if (params.authSecret) {
    authSecretEnc = await encryptSecret(params.authSecret, encKey);
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM bot_openapi_configs WHERE bot_id = ? LIMIT 1`,
  )
    .bind(params.botId)
    .first<{ id: string }>();

  const configId = existing?.id ?? randomId();
  if (existing) {
    await env.DB.prepare(
      `UPDATE bot_openapi_configs SET base_url = ?, spec_json = ?, auth_type = ?, auth_header_name = ?, auth_secret_enc = COALESCE(?, auth_secret_enc), enabled = 1, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(
        params.baseUrl,
        specStr,
        params.authType ?? "none",
        params.authHeaderName ?? null,
        authSecretEnc,
        configId,
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO bot_openapi_configs (id, bot_id, base_url, spec_json, auth_type, auth_header_name, auth_secret_enc, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
      .bind(
        configId,
        params.botId,
        params.baseUrl,
        specStr,
        params.authType ?? "none",
        params.authHeaderName ?? null,
        authSecretEnc,
      )
      .run();
  }

  const sync = await syncOpenApiTools(env.DB, params.botId, configId, specStr);
  return {
    ok: true,
    configId,
    toolsSynced: sync.count,
    error: sync.error,
  };
}
