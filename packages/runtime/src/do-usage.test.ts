import { describe, expect, it } from "vitest";
import { RAG_METERING_CREDITS_PER_MESSAGE } from "@chatbot/domain";
import { assertOrgUsage, recordOrgUsage } from "./do-usage";

type UsageRow = {
  org_id: string;
  period_start: string;
  ai_credits_used: number;
  messages_count: number;
  setup_credits_used: number;
  rag_meter_credits: number;
};

function periodStartIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Minimal D1 mock for usage_counters + org_wallets reads/writes used by do-usage. */
function createUsageDb(initial?: Partial<UsageRow>): {
  db: D1Database;
  getRow: (orgId: string) => UsageRow | undefined;
} {
  const period = periodStartIso();
  const rows = new Map<string, UsageRow>();

  if (initial?.org_id) {
    rows.set(initial.org_id, {
      org_id: initial.org_id,
      period_start: initial.period_start ?? period,
      ai_credits_used: initial.ai_credits_used ?? 0,
      messages_count: initial.messages_count ?? 0,
      setup_credits_used: initial.setup_credits_used ?? 0,
      rag_meter_credits: initial.rag_meter_credits ?? 0,
    });
  }

  const db = {
    prepare(sql: string) {
      let binds: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          binds = args;
          return this;
        },
        async first<T>(): Promise<T | null> {
          const orgId = String(binds[0] ?? "");
          if (sql.includes("FROM orgs WHERE")) {
            return { plan_slug: "business" } as T;
          }
          if (sql.includes("FROM org_wallets")) {
            return { balance_credits: 0 } as T;
          }
          if (sql.includes("FROM usage_counters")) {
            const row = rows.get(orgId);
            return (row ?? null) as T | null;
          }
          return null;
        },
        async run() {
          if (!sql.includes("INSERT INTO usage_counters")) return { success: true };
          const [
            orgId,
            periodStart,
            aiDelta,
            msgDelta,
            setupDelta,
            ragDelta,
          ] = binds as [string, string, number, number, number, number];
          const prev = rows.get(orgId);
          if (!prev || prev.period_start !== periodStart) {
            rows.set(orgId, {
              org_id: orgId,
              period_start: periodStart,
              ai_credits_used: aiDelta,
              messages_count: msgDelta,
              setup_credits_used: setupDelta,
              rag_meter_credits: ragDelta,
            });
          } else {
            rows.set(orgId, {
              ...prev,
              ai_credits_used: prev.ai_credits_used + aiDelta,
              messages_count: prev.messages_count + msgDelta,
              setup_credits_used: prev.setup_credits_used + setupDelta,
              rag_meter_credits: prev.rag_meter_credits + ragDelta,
            });
          }
          return { success: true };
        },
      };
    },
  } as unknown as D1Database;

  return {
    db,
    getRow: (orgId: string) => rows.get(orgId),
  };
}

describe("do-usage (visitor turn metering)", () => {
  it("increments messages and RAG credits per visitor message", async () => {
    const orgId = "org_test";
    const { db, getRow } = createUsageDb({
      org_id: orgId,
      period_start: periodStartIso(),
    });

    await recordOrgUsage(db, orgId, "business", {
      messages: 1,
      credits: 10,
    });

    const row = getRow(orgId);
    expect(row?.messages_count).toBe(1);
    expect(row?.ai_credits_used).toBe(10);
    expect(row?.rag_meter_credits).toBe(RAG_METERING_CREDITS_PER_MESSAGE);
  });

  it("accumulates across multiple recordOrgUsage calls (HTTP stream path)", async () => {
    const orgId = "org_stream";
    const { db, getRow } = createUsageDb({
      org_id: orgId,
      period_start: periodStartIso(),
    });

    for (let i = 0; i < 3; i++) {
      await recordOrgUsage(db, orgId, "starter", {
        messages: 1,
        credits: 6,
      });
    }

    const row = getRow(orgId);
    expect(row?.messages_count).toBe(3);
    expect(row?.rag_meter_credits).toBe(3 * RAG_METERING_CREDITS_PER_MESSAGE);
    expect(row?.ai_credits_used).toBe(18);
  });

  it("assertOrgUsage rejects when messages would exceed plan", async () => {
    const orgId = "org_cap";
    const { db } = createUsageDb({
      org_id: orgId,
      period_start: periodStartIso(),
      messages_count: 50_000,
    });

    const check = await assertOrgUsage(db, orgId, "business", { messages: 1 });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe("usage_messages_exceeded");
  });
});
