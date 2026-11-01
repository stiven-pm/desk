import {
  agentDrivenWizardEnabled,
  agentFlowToolsEnabled,
  integrationCodeModeEnabled,
  type HarnessEnv,
} from "./harness/flags";

/**
 * Verbose console tracing for visitor/agent pipeline (wrangler tail / local).
 * Set DESK_TRACE=1 on the worker. DESK_LLM_DEBUG=1 also enables LLM payload previews.
 */

export type DeskTraceEnv = {
  DESK_TRACE?: string;
  DESK_LLM_DEBUG?: string;
};

export type DeskTraceRuntimeEnv = HarnessEnv &
  DeskTraceEnv & {
    LOADER?: unknown;
    DESK_CODEMODE?: unknown;
  };

export type DeskTraceScope = {
  orgId?: string;
  botId?: string;
  conversationId?: string;
};

const MAX_STRING = 800;
const MAX_CODE = 1200;
const MAX_JSON = 2000;

export function deskTraceEnabled(env: DeskTraceEnv | undefined): boolean {
  return env?.DESK_TRACE?.trim() === "1";
}

export function deskTraceLlmVerbose(env: DeskTraceEnv | undefined): boolean {
  return (
    deskTraceEnabled(env) || env?.DESK_LLM_DEBUG?.trim() === "1"
  );
}

export function deskTraceClip(text: string, max = MAX_STRING): string {
  const t = text ?? "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…[+${t.length - max}]`;
}

export function deskTraceJson(value: unknown, max = MAX_JSON): string {
  try {
    return deskTraceClip(JSON.stringify(value), max);
  } catch {
    return deskTraceClip(String(value), max);
  }
}

export function deskTraceMessagesSummary(
  messages: Array<{ role?: string; content?: string; name?: string }>,
): Array<{ role: string; chars: number; preview: string; name?: string }> {
  return messages.map((m) => ({
    role: String(m.role ?? "?"),
    chars: String(m.content ?? "").length,
    preview: deskTraceClip(String(m.content ?? ""), 160),
    ...(m.name ? { name: m.name } : {}),
  }));
}

export function deskTraceToolNames(
  tools: Array<{ function?: { name?: string } }> | undefined,
): string[] {
  return (tools ?? []).map((t) => t.function?.name ?? "?");
}

/** One JSON line per event — filter with `desk_trace` in tail. */
export function deskTrace(
  env: DeskTraceEnv | undefined,
  phase: string,
  detail: Record<string, unknown>,
  scope?: DeskTraceScope,
): void {
  if (!deskTraceEnabled(env)) return;
  console.log(
    JSON.stringify({
      tag: "desk_trace",
      phase,
      at: new Date().toISOString(),
      ...scope,
      ...detail,
    }),
  );
}

export function deskTraceRuntimeFlags(
  env: DeskTraceRuntimeEnv,
): Record<string, boolean> {
  return {
    agentFlowTools: agentFlowToolsEnabled(env),
    agentDrivenWizard: agentDrivenWizardEnabled(env),
    integrationCodeMode: integrationCodeModeEnabled(env),
    hasLoader: Boolean(env.LOADER),
    hasDeskCodemodeService: Boolean(env.DESK_CODEMODE),
  };
}

export function deskTraceCodePreview(code: string): {
  chars: number;
  preview: string;
} {
  const c = code ?? "";
  return { chars: c.length, preview: deskTraceClip(c, MAX_CODE) };
}
