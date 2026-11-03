import type { Context, Next } from "hono";
import type { AppEnv } from "../types";
import { recordOpsSignal } from "@chatbot/runtime/ops-telemetry";

export async function opsApiTelemetryMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<void> {
  const started = Date.now();
  await next();
  const status = c.res.status;
  if (status < 400) return;

  const requestId = c.get("requestId") as string | undefined;
  const path = new URL(c.req.url).pathname;
  const severity = status >= 500 ? "error" : "warn";
  const orgId = c.get("orgId") as string | undefined;

  void recordOpsSignal(c.env.DB, {
    severity,
    category: "api",
    code: `http_${status}`,
    summary: `${c.req.method} ${path} → ${status}`,
    orgId: orgId ?? null,
    requestId: requestId ?? null,
    durationMs: Date.now() - started,
    detail: {
      method: c.req.method,
      path,
    },
  });
}
