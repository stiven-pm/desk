export type OpsSignalSeverity = "error" | "warn" | "info";

export type OpsSignalCategory =
  | "llm"
  | "agent"
  | "integration"
  | "codemode"
  | "api"
  | "usage"
  | "commerce";

export type OpsSignalInput = {
  severity: OpsSignalSeverity;
  category: OpsSignalCategory;
  code: string;
  summary?: string;
  orgId?: string | null;
  botId?: string | null;
  conversationId?: string | null;
  requestId?: string | null;
  durationMs?: number | null;
  credits?: number | null;
  detail?: Record<string, unknown>;
};

export type OpsVisitorTurnInput = {
  orgId: string;
  botId?: string | null;
  durationMs: number;
  creditsMetered: number;
  llmRounds?: number;
  degraded?: boolean;
  errorCode?: string | null;
};

const MAX_SUMMARY = 500;
const MAX_DETAIL_JSON = 4000;

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function safeDetailJson(detail: Record<string, unknown> | undefined): string {
  try {
    return clip(JSON.stringify(detail ?? {}), MAX_DETAIL_JSON);
  } catch {
    return "{}";
  }
}

export async function recordOpsSignal(
  db: D1Database | undefined,
  input: OpsSignalInput,
): Promise<void> {
  if (!db) return;
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ops_signal_events
       (id, severity, category, code, org_id, bot_id, conversation_id, request_id, duration_ms, credits, summary, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.severity,
      input.category,
      input.code,
      input.orgId ?? null,
      input.botId ?? null,
      input.conversationId ?? null,
      input.requestId ?? null,
      input.durationMs ?? null,
      input.credits ?? null,
      clip(input.summary ?? input.code, MAX_SUMMARY),
      safeDetailJson(input.detail),
    )
    .run();
}

export async function recordOpsVisitorTurn(
  db: D1Database | undefined,
  input: OpsVisitorTurnInput,
): Promise<void> {
  if (!db || !input.orgId) return;
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ops_visitor_turns
       (id, org_id, bot_id, duration_ms, credits_metered, llm_rounds, degraded, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.orgId,
      input.botId ?? null,
      Math.max(0, Math.round(input.durationMs)),
      Math.max(0, Math.round(input.creditsMetered)),
      Math.max(1, input.llmRounds ?? 1),
      input.degraded ? 1 : 0,
      input.errorCode ?? null,
    )
    .run();
}

/** Cron: drop old telemetry (keep enough for p95 windows). */
export async function purgeOpsTelemetry(db: D1Database): Promise<{
  signalsDeleted: number;
  turnsDeleted: number;
}> {
  const signals = await db
    .prepare(
      `DELETE FROM ops_signal_events WHERE created_at < datetime('now', '-45 days')`,
    )
    .run();
  const turns = await db
    .prepare(
      `DELETE FROM ops_visitor_turns WHERE created_at < datetime('now', '-90 days')`,
    )
    .run();
  return {
    signalsDeleted: signals.meta.changes ?? 0,
    turnsDeleted: turns.meta.changes ?? 0,
  };
}
