import type { Env } from "../types";

export function trackEvent(
  env: Env,
  event: {
    tenantId: string;
    botId?: string;
    name: string;
    credits?: number;
    latencyMs?: number;
  },
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [event.name, event.tenantId, event.botId ?? ""],
      doubles: [event.credits ?? 0, event.latencyMs ?? 0],
      indexes: [event.tenantId],
    });
  } catch {
    // non-fatal
  }
}

export function logStructured(
  level: "info" | "warn" | "error",
  fields: Record<string, string | number | undefined>,
): void {
  console.log(JSON.stringify({ level, ts: new Date().toISOString(), ...fields }));
}
