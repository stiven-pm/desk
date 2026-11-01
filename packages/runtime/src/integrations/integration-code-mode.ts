import type { AgentTool, LlmToolSchema } from "./types";
import { parametersToJsonSchema } from "./openapi";
import { integrationCodeModeEnabled } from "../harness/flags";
import {
  runDeskCallIntegration,
  runDeskSearchIntegrations,
} from "./integration-meta-tools";
import {
  runDeskCodemodeInReusableWorker,
  createDeskCodemodeBridge,
  type DeskCodemodeRpc,
  type WorkerLoaderBinding,
} from "./desk-codemode-sandbox";
import {
  deskTrace,
  deskTraceCodePreview,
  deskTraceClip,
  deskTraceJson,
  type DeskTraceEnv,
  type DeskTraceScope,
} from "../desk-trace";

export const DESK_CODEMODE = "desk_codemode";

const MAX_CODE_CHARS = 16_000;
const MAX_CALLS_PER_RUN = 12;

export { integrationCodeModeEnabled };

export function isDeskCodemodeTool(name: string): boolean {
  return name === DESK_CODEMODE;
}

function paramNames(at: AgentTool): string[] {
  if (at.kind === "http") {
    return at.tool.parameters.map((p) => p.name);
  }
  if (at.kind === "integration") {
    return (at.tool.operation.params ?? []).map((p) => p.key);
  }
  if (at.kind === "mcp") {
    const props = (at.tool.inputSchema as { properties?: Record<string, unknown> })
      ?.properties;
    return props ? Object.keys(props) : [];
  }
  return [];
}

/** Compact API surface for the system prompt (integrations stay out of the tool schema). */
export function buildIntegrationApiReference(tools: AgentTool[]): string {
  if (!tools.length) return "";
  const lines = tools.map((at) => {
    const name =
      at.kind === "http"
        ? at.tool.name
        : at.kind === "mcp"
          ? at.tool.name
          : at.tool.name;
    const desc =
      at.kind === "http"
        ? at.tool.description
        : at.kind === "mcp"
          ? at.tool.description
          : at.tool.description;
    const params = paramNames(at).join(", ");
    const confirm =
      at.kind === "integration" && at.tool.requiresConfirm
        ? " (requires confirm:true)"
        : "";
    return `- ${name}(${params || "…"})${confirm}: ${desc.slice(0, 220)}`;
  });
  return lines.join("\n");
}

export function deskCodemodeToolSchema(): LlmToolSchema {
  return {
    type: "function",
    function: {
      name: DESK_CODEMODE,
        description:
        "Run short async JavaScript to call business integrations (ERP, CRM, payment templates, APIs). " +
        "Inside your code use global desk.search(query, limit?) → { ok, tools: [{ name, description }] }; " +
        "desk.call(name, args?) → parsed JSON from the integration (same shapes as Integration API). " +
        "Compose, filter, return the value you need. Tool names must match Integration API in the system prompt.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "Async JavaScript body. Use return with the final value. Example: " +
              "const hits = await desk.search('order status'); " +
              "const o = await desk.call(hits.tools[0].name, { orderId: 'RK-1' }); return o;",
          },
        },
        required: ["code"],
      },
    },
  };
}

function stripCodeFences(raw: string): string {
  let code = raw.trim();
  const fence = /^```(?:javascript|js|typescript|ts)?\s*\n?([\s\S]*?)```$/i.exec(
    code,
  );
  if (fence) code = fence[1].trim();
  return code;
}

export async function runDeskCodemode(args: {
  code: string;
  allTools: AgentTool[];
  toolIndex: Map<string, AgentTool>;
  botId?: string;
  loader?: WorkerLoaderBinding;
  deskCodemode?: {
    get(options: { props: { botId: string } }): DeskCodemodeRpc;
  };
  compatibilityDate?: string;
  traceEnv?: DeskTraceEnv;
  traceScope?: DeskTraceScope;
}): Promise<string> {
  const code = stripCodeFences(String(args.code ?? ""));
  if (!code) {
    return JSON.stringify({ ok: false, error: "missing_code" });
  }
  if (code.length > MAX_CODE_CHARS) {
    return JSON.stringify({ ok: false, error: "code_too_long" });
  }

  const codePreview = deskTraceCodePreview(code);
  deskTrace(args.traceEnv, "codemode.invoke", {
    ...codePreview,
    botId: args.botId ?? null,
    path:
      args.loader && args.deskCodemode && args.botId
        ? "dynamic_worker"
        : "do_fallback",
  }, args.traceScope);

  if (args.loader && args.deskCodemode && args.botId) {
    try {
      const desk = args.deskCodemode.get({ props: { botId: args.botId } });
      const raw = await runDeskCodemodeInReusableWorker({
        loader: args.loader,
        desk,
        botId: args.botId,
        code,
        compatibilityDate: args.compatibilityDate ?? "2026-04-01",
        traceEnv: args.traceEnv,
        traceScope: args.traceScope,
      });
      const parsed = JSON.parse(raw) as {
        ok?: boolean;
        result?: unknown;
        error?: string;
        detail?: string;
      };
      if (parsed.ok) {
        deskTrace(args.traceEnv, "codemode.done", {
          sandbox: "dynamic_worker",
          result: deskTraceJson(parsed.result),
        }, args.traceScope);
        return JSON.stringify({ ok: true, result: parsed.result, sandbox: "dynamic_worker" });
      }
      deskTrace(args.traceEnv, "codemode.error", {
        sandbox: "dynamic_worker",
        raw: deskTraceClip(raw, 600),
      }, args.traceScope);
      return raw;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      deskTrace(args.traceEnv, "codemode.error", {
        sandbox: "dynamic_worker",
        error: "dynamic_worker_failed",
        detail: detail.slice(0, 500),
      }, args.traceScope);
      return JSON.stringify({
        ok: false,
        error: "dynamic_worker_failed",
        detail: detail.slice(0, 500),
      });
    }
  }

  const desk = createDeskCodemodeBridge({
    maxCalls: MAX_CALLS_PER_RUN,
    search: (query, limit) =>
      runDeskSearchIntegrations(args.allTools, { query, limit }),
    call: (name, callArgs) =>
      runDeskCallIntegration(args.toolIndex, {
        name,
        arguments: callArgs ?? {},
      }),
  });

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {})
      .constructor as new (
      ...args: string[]
    ) => (...fnArgs: unknown[]) => Promise<unknown>;
    const fn = new AsyncFunction(
      "desk",
      `"use strict";\n${code}`,
    );
    const result = await fn(desk);
    const out = JSON.stringify({
      ok: true,
      result,
      calls: desk.callCount(),
    });
    deskTrace(args.traceEnv, "codemode.done", {
      sandbox: "do_fallback",
      result: deskTraceJson(result),
      calls: desk.callCount(),
    }, args.traceScope);
    return out;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    deskTrace(args.traceEnv, "codemode.error", {
      sandbox: "do_fallback",
      error: "codemode_failed",
      detail: message.slice(0, 500),
      calls: desk.callCount(),
    }, args.traceScope);
    return JSON.stringify({
      ok: false,
      error: "codemode_failed",
      detail: message.slice(0, 500),
      calls: desk.callCount(),
    });
  }
}

/** Legacy ranked path: expose one integration as LLM schema (code mode off). */
export function agentToolToLlmSchema(at: AgentTool): LlmToolSchema {
  if (at.kind === "http") {
    return {
      type: "function",
      function: {
        name: at.tool.name,
        description: at.tool.description.slice(0, 800),
        parameters: parametersToJsonSchema(at.tool.parameters),
      },
    };
  }
  if (at.kind === "integration") {
    return {
      type: "function",
      function: {
        name: at.tool.name,
        description: at.tool.description.slice(0, 800),
        parameters: at.tool.inputSchema,
      },
    };
  }
  return {
    type: "function",
    function: {
      name: at.tool.name,
      description: at.tool.description.slice(0, 800),
      parameters: (at.tool.inputSchema ?? {
        type: "object",
        properties: {},
      }) as Record<string, unknown>,
    },
  };
}
