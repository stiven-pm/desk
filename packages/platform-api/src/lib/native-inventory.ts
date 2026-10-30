import { parseCommerceManifest } from "@chatbot/domain";
import type { Env } from "../types";

export async function isNativeInventoryEnabled(
  env: Env,
  orgId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT manifest_json FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ manifest_json: string | null }>();
  const manifest = parseCommerceManifest(row?.manifest_json);
  return Boolean(manifest.nativeInventoryEnabled);
}
