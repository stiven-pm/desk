/** Fixed Dynamic Worker module — reused via LOADER.get(id). LLM code is POST body only. */

import {
  deskTrace,
  deskTraceClip,
  type DeskTraceEnv,
  type DeskTraceScope,
} from "../desk-trace";

export const DESK_CODEMODE_SANDBOX_VERSION = "v1";

export function deskCodemodeWorkerId(botId: string): string {
  return `desk-cm-${botId}-${DESK_CODEMODE_SANDBOX_VERSION}`;
}

/** Stable main module; do not embed visitor-generated code here. */
export const DESK_CODEMODE_SANDBOX_MAIN = `
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }
    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "invalid_json" });
    }
    const code = String(payload.code ?? "").trim();
    if (!code) {
      return Response.json({ ok: false, error: "missing_code" });
    }
    if (code.length > 16000) {
      return Response.json({ ok: false, error: "code_too_long" });
    }
    const desk = {
      search: (query, limit) =>
        env.DESK.search(String(query ?? ""), limit).then((t) => JSON.parse(t)),
      call: (name, args) =>
        env.DESK.call(String(name ?? ""), args ?? {}).then((t) => JSON.parse(t)),
    };
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction("desk", '"use strict";\\n' + code);
      const result = await fn(desk);
      return Response.json({ ok: true, result });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return Response.json({ ok: false, error: "codemode_failed", detail: detail.slice(0, 500) });
    }
  },
};
`.trim();

export type DeskCodemodeRpc = {
  search(query: string, limit?: number): Promise<string>;
  call(name: string, args: Record<string, unknown>): Promise<string>;
};

export type WorkerLoaderBinding = {
  get(
    id: string,
    codeCallback: () => Promise<{
      compatibilityDate: string;
      mainModule: string;
      modules: Record<string, string>;
      globalOutbound: null;
      env?: Record<string, unknown>;
    }>,
  ): {
    getEntrypoint(): {
      fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
    };
  };
};

/** Same desk.* surface for LLM code in DO fallback and Dynamic Worker sandbox. */
export function createDeskCodemodeBridge(handlers: {
  search: (query: string, limit?: number) => string;
  call: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxCalls?: number;
}) {
  let callCount = 0;
  const max = handlers.maxCalls ?? 12;
  return {
    search(query: string, limit?: number) {
      return JSON.parse(handlers.search(query, limit)) as unknown;
    },
    async call(name: string, callArgs?: Record<string, unknown>) {
      if (callCount >= max) throw new Error("desk_call_limit");
      callCount += 1;
      const raw = await handlers.call(name, callArgs ?? {});
      return JSON.parse(raw) as unknown;
    },
    callCount: () => callCount,
  };
}

export async function runDeskCodemodeInReusableWorker(args: {
  loader: WorkerLoaderBinding;
  desk: DeskCodemodeRpc;
  botId: string;
  code: string;
  compatibilityDate: string;
  traceEnv?: DeskTraceEnv;
  traceScope?: DeskTraceScope;
}): Promise<string> {
  const workerId = deskCodemodeWorkerId(args.botId);
  deskTrace(args.traceEnv, "codemode.loader_get", {
    workerId,
    codeChars: args.code.length,
    sandboxVersion: DESK_CODEMODE_SANDBOX_VERSION,
  }, args.traceScope);

  const workerCode = {
    compatibilityDate: args.compatibilityDate,
    mainModule: "main.js",
    modules: { "main.js": DESK_CODEMODE_SANDBOX_MAIN },
    globalOutbound: null as null,
    env: { DESK: args.desk },
  };

  const stub = args.loader.get(workerId, () => Promise.resolve(workerCode));
  const res = await stub.getEntrypoint().fetch(
    new Request("https://desk.internal/codemode/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: args.code }),
    }),
  );
  const text = await res.text();
  deskTrace(args.traceEnv, "codemode.sandbox_http", {
    workerId,
    status: res.status,
    ok: res.ok,
    bodyPreview: deskTraceClip(text, 600),
  }, args.traceScope);
  if (!res.ok) {
    return JSON.stringify({
      ok: false,
      error: "sandbox_http",
      status: res.status,
      detail: text.slice(0, 400),
    });
  }
  return text;
}
