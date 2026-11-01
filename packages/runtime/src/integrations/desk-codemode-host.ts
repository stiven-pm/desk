import { WorkerEntrypoint } from "cloudflare:workers";
import { loadBotAgentTools } from "./load-tools";
import type { AgentTool } from "./types";
import {
  runDeskCallIntegration,
  runDeskSearchIntegrations,
} from "./integration-meta-tools";
import { deskTrace, deskTraceClip, type DeskTraceEnv } from "../desk-trace";

type HostEnv = DeskTraceEnv & {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
};

/** RPC bridge: integration search/call scoped to one bot (passed via entrypoint props). */
export class DeskCodemodeHost extends WorkerEntrypoint<
  HostEnv,
  { botId: string }
> {
  private toolsPromise: Promise<AgentTool[]> | null = null;

  private async tools(): Promise<AgentTool[]> {
    if (!this.toolsPromise) {
      this.toolsPromise = loadBotAgentTools(
        this.env.DB,
        this.props.botId,
        this.env.ENCRYPTION_KEY,
      );
    }
    return this.toolsPromise;
  }

  async search(query: string, limit?: number): Promise<string> {
    deskTrace(this.env, "codemode.host_search", {
      botId: this.props.botId,
      query: deskTraceClip(String(query ?? ""), 200),
      limit: limit ?? null,
    });
    const all = await this.tools();
    const out = runDeskSearchIntegrations(all, { query, limit });
    deskTrace(this.env, "codemode.host_search_result", {
      botId: this.props.botId,
      preview: deskTraceClip(out, 500),
    });
    return out;
  }

  async call(name: string, args: Record<string, unknown>): Promise<string> {
    deskTrace(this.env, "codemode.host_call", {
      botId: this.props.botId,
      name,
      args: deskTraceClip(JSON.stringify(args ?? {}), 400),
    });
    const all = await this.tools();
    const toolIndex = new Map(all.map((t) => [t.tool.name, t]));
    const out = await runDeskCallIntegration(toolIndex, { name, arguments: args ?? {} });
    deskTrace(this.env, "codemode.host_call_result", {
      botId: this.props.botId,
      name,
      preview: deskTraceClip(out, 500),
    });
    return out;
  }
}
