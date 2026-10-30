import type { AgentTool } from "../integrations/types";
import { scoreToolsForMessage } from "../integrations/tool-rank";
import { MAX_SCHEMAS_PER_TURN } from "../integrations/tool-catalog";
import type { LlmEnv } from "../llm-client";
import { harnessRouterEnabled, type HarnessEnv } from "./flags";

type RouterEnv = HarnessEnv & LlmEnv & { TENANT_CACHE?: KVNamespace };

export async function routeToolNames(
  env: RouterEnv,
  userMessage: string,
  tools: AgentTool[],
): Promise<string[] | null> {
  if (!harnessRouterEnabled(env) || tools.length <= 20) return null;

  const cacheKey = `harness:route:${hashQuery(userMessage)}`;
  if (env.TENANT_CACHE) {
    const cached = await env.TENANT_CACHE.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        /* ignore */
      }
    }
  }

  const scored = scoreToolsForMessage(tools, userMessage);
  const names = scored
    .filter((s) => s.score >= 1)
    .slice(0, MAX_SCHEMAS_PER_TURN)
    .map((s) => s.t.tool.name);

  if (!names.length) return null;

  if (env.TENANT_CACHE) {
    await env.TENANT_CACHE.put(cacheKey, JSON.stringify(names), {
      expirationTtl: 3600,
    });
  }
  return names;
}

function hashQuery(q: string): string {
  const n = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .slice(0, 200);
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return String(h);
}
