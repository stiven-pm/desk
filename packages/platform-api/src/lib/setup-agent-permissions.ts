import {
  planAllowsEnterpriseShell,
  planFromSlug,
  PLAN_LIMITS,
} from "@chatbot/domain";
import type { Env } from "../types";

const MUTATING_TOOLS = new Set([
  "desk_set_instructions",
  "desk_add_http_tool",
  "desk_register_mcp_server",
  "desk_upsert_connector",
  "desk_import_openapi_url",
  "desk_skill_save",
  "desk_skill_publish",
  "desk_skill_archive",
  "desk_request_credentials",
  "desk_enterprise_shell_queue",
]);

export function isSetupMutatingTool(name: string): boolean {
  return MUTATING_TOOLS.has(name);
}

export const SETUP_VERIFY_TOOLS = new Set([
  "desk_workspace_status",
  "desk_probe_http",
]);

export async function assertSetupMutationAllowed(
  env: Env,
  orgId: string,
  toolName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ plan_slug: string }>();
  const limits = PLAN_LIMITS[planFromSlug(row?.plan_slug ?? "starter")];

  if (toolName === "desk_enterprise_shell_queue" && !planAllowsEnterpriseShell(limits)) {
    return { ok: false, error: "plan_enterprise_shell_required" };
  }

  return { ok: true };
}
