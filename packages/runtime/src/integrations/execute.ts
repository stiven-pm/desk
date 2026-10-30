import { assertPublicHttpUrl, assertUrlHostAllowed } from "@chatbot/domain";
import type { BotHttpTool } from "./types";
import { redactSecretsInText } from "./http-response-redact";

export async function executeHttpTool(
  tool: BotHttpTool,
  args: Record<string, unknown>,
): Promise<string> {
  if (!tool.baseUrl?.trim()) {
    return JSON.stringify({ error: "base_url_missing" });
  }

  let path = tool.path;
  const query = new URLSearchParams();
  let body: string | undefined;

  for (const [key, value] of Object.entries(args)) {
    if (key === "body") {
      body =
        typeof value === "string" ? value : JSON.stringify(value ?? {});
      continue;
    }
    const placeholder = `{${key}}`;
    if (path.includes(placeholder)) {
      path = path.replaceAll(placeholder, encodeURIComponent(String(value)));
    } else {
      query.set(key, String(value));
    }
  }

  const base = tool.baseUrl.replace(/\/$/, "");
  const urlString = `${base}${path.startsWith("/") ? path : `/${path}`}${query.toString() ? `?${query}` : ""}`;

  let requestUrl: URL;
  try {
    requestUrl = assertPublicHttpUrl(urlString);
    assertUrlHostAllowed(requestUrl, tool.baseUrl);
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : "url_blocked",
    });
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (tool.authType === "bearer" && tool.authSecret) {
    headers.Authorization = `Bearer ${tool.authSecret}`;
  }
  if (tool.authType === "header" && tool.authHeaderName && tool.authSecret) {
    headers[tool.authHeaderName] = tool.authSecret;
  }
  if (body) headers["Content-Type"] = "application/json";
  if (tool.extraHeaders) {
    for (const [k, v] of Object.entries(tool.extraHeaders)) {
      headers[k] = v;
    }
  }

  const res = await fetch(requestUrl.toString(), {
    method: tool.method,
    headers,
    body: body && tool.method !== "GET" ? body : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const redacted = redactSecretsInText(text, [
    tool.authSecret,
    headers.Authorization,
    tool.authHeaderName ? headers[tool.authHeaderName] : undefined,
  ]);
  const snippet = redacted.slice(0, 4000);
  return JSON.stringify({
    status: res.status,
    ok: res.ok,
    body: snippet,
  });
}

export async function executeMcpTool(
  serverUrl: string,
  headers: Record<string, string>,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const realName = toolName.replace(/^mcp_/, "");
  const res = await fetch(serverUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: realName, arguments: args },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  return text.slice(0, 4000);
}
