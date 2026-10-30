import type { Env } from "../types";

/** Marca trabajos en cola como listos para consola externa (placeholder hasta Moltworker). */
export async function processEnterpriseShellQueue(env: Env): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id FROM org_enterprise_shell_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 5`,
  ).all<{ id: string }>();

  let n = 0;
  for (const row of rows.results ?? []) {
    await env.DB.prepare(
      `UPDATE org_enterprise_shell_jobs
       SET status = 'ready', result_text = COALESCE(result_text, 'Job listo para consola Enterprise. Abre el enlace del panel.'),
           updated_at = datetime('now')
       WHERE id = ? AND status = 'queued'`,
    )
      .bind(row.id)
      .run();
    n += 1;
  }
  return n;
}
