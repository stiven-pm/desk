export type ParsedCurl = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  baseUrl: string;
  path: string;
  headers: Record<string, string>;
  authType: "none" | "bearer" | "header";
  authHeaderName?: string;
  authSecret?: string;
};

function shellUnquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith("'") && t.endsWith("'")) ||
    (t.startsWith('"') && t.endsWith('"'))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function splitCurlTokens(raw: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      cur += ch;
      if (ch === quote && raw[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === " " || ch === "\n" || ch === "\t") {
      if (cur) tokens.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

export function parseCurlCommand(raw: string): ParsedCurl | null {
  const normalized = raw.trim().replace(/\\\s*\n/g, " ");
  if (!/^curl\s/i.test(normalized)) return null;

  const tokens = splitCurlTokens(normalized);
  let method: ParsedCurl["method"] = "GET";
  let url = "";
  const headers: Record<string, string> = {};

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-X" || t === "--request") {
      const m = tokens[++i]?.toUpperCase();
      if (m && ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(m)) {
        method = m as ParsedCurl["method"];
      }
      continue;
    }
    if (t === "-H" || t === "--header") {
      const h = shellUnquote(tokens[++i] ?? "");
      const idx = h.indexOf(":");
      if (idx > 0) {
        const name = h.slice(0, idx).trim();
        const value = h.slice(idx + 1).trim();
        headers[name] = value;
      }
      continue;
    }
    const maybeUrl = shellUnquote(t);
    if (maybeUrl.startsWith("http://") || maybeUrl.startsWith("https://")) {
      url = maybeUrl;
    }
  }

  if (!url) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const baseUrl = parsedUrl.origin;
  const path = `${parsedUrl.pathname}${parsedUrl.search}` || "/";

  let authType: ParsedCurl["authType"] = "none";
  let authHeaderName: string | undefined;
  let authSecret: string | undefined;

  const auth = headers.Authorization ?? headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) {
    authType = "bearer";
    authSecret = auth.slice(7).trim();
    delete headers.Authorization;
    delete headers.authorization;
  } else {
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase();
      if (
        lower.includes("api-key") ||
        lower.includes("apikey") ||
        lower === "x-api-key" ||
        lower === "token"
      ) {
        authType = "header";
        authHeaderName = name;
        authSecret = value;
        delete headers[name];
        break;
      }
    }
  }

  return {
    method,
    url,
    baseUrl,
    path,
    headers,
    authType,
    authHeaderName,
    authSecret,
  };
}
