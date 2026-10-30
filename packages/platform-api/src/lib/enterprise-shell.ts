import { planAllowsEnterpriseShell, planFromSlug, PLAN_LIMITS } from "@chatbot/domain";
import { randomId } from "./http";
import type { Env } from "../types";

export async function orgPlanAllowsShell(env: Env, orgId: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT plan_slug FROM orgs WHERE id = ?`)
    .bind(orgId)
    .first<{ plan_slug: string }>();
  const limits = PLAN_LIMITS[planFromSlug(row?.plan_slug ?? "starter")];
  return planAllowsEnterpriseShell(limits);
}

export async function queueEnterpriseShellJob(
  env: Env,
  params: {
    orgId: string;
    botId: string;
    createdBy: string;
    summary: string;
    instructionsMd: string;
  },
): Promise<
  | { ok: true; jobId: string; consoleHint: string }
  | { ok: false; error: string }
> {
  if (!(await orgPlanAllowsShell(env, params.orgId))) {
    return { ok: false, error: "plan_enterprise_shell_required" };
  }

  const id = randomId();
  await env.DB.prepare(
    `INSERT INTO org_enterprise_shell_jobs (id, org_id, bot_id, created_by, status, summary, instructions_md)
     VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
  )
    .bind(
      id,
      params.orgId,
      params.botId,
      params.createdBy,
      params.summary.slice(0, 500),
      params.instructionsMd.slice(0, 24_000),
    )
    .run();

  const base = env.ENTERPRISE_SHELL_BASE_URL?.trim();
  const consoleHint = base
    ? `${base.replace(/\/$/, "")}/sessions/${id}`
    : `Panel Desk → Agente Setup → trabajos Enterprise (id: ${id}). Conecta ENTERPRISE_SHELL_BASE_URL para consola dedicada.`;

  return { ok: true, jobId: id, consoleHint };
}

export async function listEnterpriseShellJobs(
  env: Env,
  orgId: string,
  limit = 10,
) {
  const rows = await env.DB.prepare(
    `SELECT id, bot_id, status, summary, result_text, created_at, updated_at
     FROM org_enterprise_shell_jobs
     WHERE org_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(orgId, limit)
    .all();
  return rows.results ?? [];
}
