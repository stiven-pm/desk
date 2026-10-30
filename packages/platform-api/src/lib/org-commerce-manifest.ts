import { buyerFieldsForType, parseCommerceManifest, type CommerceBuyerType } from "@chatbot/domain";
import type { Env } from "../types";

export async function loadOrgCommerceManifest(
  env: Env,
  orgId: string,
): Promise<ReturnType<typeof parseCommerceManifest>> {
  const row = await env.DB.prepare(
    `SELECT manifest_json, mode FROM org_commerce_config WHERE org_id = ?`,
  )
    .bind(orgId)
    .first<{ manifest_json: string | null; mode: string }>();
  if (!row) return parseCommerceManifest(null);
  const m = parseCommerceManifest(row.manifest_json);
  if (row.mode === "checkout_link") m.mode = "checkout_link";
  return m;
}

export function storefrontBuyerSteps(
  manifest: ReturnType<typeof parseCommerceManifest>,
): string[] {
  return buyerFieldsForType("natural_person" satisfies CommerceBuyerType, manifest);
}
