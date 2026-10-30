import {
  applyResponseMap,
  assertPublicHttpUrl,
  assertUrlHostAllowed,
  connectorConfigSchema,
  effectiveOperationRequest,
  effectiveResponseMap,
  type ConnectorConfig,
  type IntegrationOperationDef,
  type ParamResolveContext,
  resolveOperationParams,
  renderTemplate,
} from "@chatbot/domain";
import { redactSecretsInText } from "./http-response-redact";

export type HttpEngineResult =
  | {
      ok: true;
      status: number;
      mapped: Record<string, unknown>;
      bodyJson: unknown;
    }
  | { ok: false; code: string; status?: number; detail?: string };

function collectSecrets(values: Record<string, string>): string[] {
  return Object.values(values).filter((v) => v.length > 0);
}

function resolveBaseUrl(
  connector: ConnectorConfig,
  fieldValues: Record<string, string>,
): string {
  const raw = connector.baseUrl?.trim() ?? "";
  if (!raw) return "";
  return renderTemplate(raw, fieldValues);
}

function normalizeAllowedHost(entry: string): string {
  const raw = entry.trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("/") || raw.includes(":")) {
    try {
      const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
      return new URL(withScheme).hostname.toLowerCase();
    } catch {
      return raw.split("/")[0]?.split(":")[0] ?? raw;
    }
  }
  return raw.split(":")[0] ?? raw;
}

function hostAllowed(
  requestUrl: URL,
  connector: ConnectorConfig,
  baseUrl: string,
): void {
  const hosts =
    connector.allowedHosts?.map((h) => normalizeAllowedHost(h)).filter(Boolean) ??
    (baseUrl ? [new URL(baseUrl).hostname.toLowerCase()] : []);
  const host = requestUrl.hostname.toLowerCase();
  if (!hosts.includes(host)) {
    throw new Error("url_host_mismatch");
  }
  if (baseUrl) assertUrlHostAllowed(requestUrl, baseUrl);
}

function unresolvedTemplateKeys(template: string): string[] {
  const keys: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    keys.push(m[1].trim());
  }
  return keys;
}

function upstreamErrorDetail(bodyJson: unknown, status: number): string | undefined {
  if (!bodyJson || typeof bodyJson !== "object") return undefined;
  const err = (bodyJson as { error?: { type?: string; reason?: string; messages?: Record<string, string[]> } }).error;
  if (!err) return undefined;
  if (err.reason) return err.reason;
  if (err.messages) {
    const parts = Object.entries(err.messages).flatMap(([k, msgs]) =>
      (msgs ?? []).map((m) => `${k}: ${m}`),
    );
    if (parts.length) return parts.join("; ");
  }
  if (err.type) return `${err.type} (HTTP ${status})`;
  return undefined;
}

function applyAuth(
  connector: ConnectorConfig,
  values: Record<string, string>,
  headers: Record<string, string>,
  query: URLSearchParams,
  operation: IntegrationOperationDef,
): void {
  const mode = operation.authMode ?? "inherit";
  if (mode === "none") return;

  if (mode === "bearer_field") {
    const key = operation.authFieldKey?.trim();
    if (!key) return;
    const token = values[key]?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    return;
  }

  const secret = connector.authFieldKey
    ? values[connector.authFieldKey]?.trim()
    : undefined;
  switch (connector.authType) {
    case "bearer":
      if (secret) headers.Authorization = `Bearer ${secret}`;
      break;
    case "header":
      if (connector.authHeaderName && secret) {
        headers[connector.authHeaderName] = secret;
      }
      break;
    case "basic": {
      const user = connector.basicUserFieldKey
        ? values[connector.basicUserFieldKey]?.trim()
        : "";
      if (user && secret) {
        headers.Authorization = `Basic ${btoa(`${user}:${secret}`)}`;
      }
      break;
    }
    case "query":
      if (connector.authHeaderName && secret) {
        query.set(connector.authHeaderName, secret);
      }
      break;
    default:
      break;
  }
}

export function buildTemplateVars(
  fieldValues: Record<string, string>,
  capabilityArgs: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...fieldValues };
  for (const [k, v] of Object.entries(capabilityArgs)) {
    out[k] = v;
    out[`ai.${k}`] = v;
  }
  if (capabilityArgs.amountInCents) {
    out.amount = capabilityArgs.amountInCents;
    out.amount_cents = capabilityArgs.amountInCents;
  }
  return out;
}

export async function executeIntegrationOperation(
  connector: ConnectorConfig,
  operation: IntegrationOperationDef,
  fieldValues: Record<string, string>,
  capabilityArgs: Record<string, string>,
  resolveCtx?: Partial<ParamResolveContext>,
): Promise<HttpEngineResult> {
  const parsedConnector = connectorConfigSchema.parse(connector);
  const paramCtx: ParamResolveContext = {
    fieldValues,
    ai: capabilityArgs,
    ctx: resolveCtx?.ctx ?? {},
    computed: resolveCtx?.computed ?? {},
  };
  const fromParams = resolveOperationParams(operation.params ?? [], paramCtx);
  const vars = { ...buildTemplateVars(fieldValues, capabilityArgs), ...fromParams };

  const { method, pathTemplate, bodyTemplate, queryTemplate } =
    effectiveOperationRequest(operation);

  const baseUrl = resolveBaseUrl(parsedConnector, vars);
  if (!baseUrl) return { ok: false, code: "base_url_missing" };

  let path = renderTemplate(pathTemplate, vars);
  for (const key of unresolvedTemplateKeys(path)) {
    return {
      ok: false,
      code: "template_unresolved",
      detail: `Falta el valor «${key}» (revisa credenciales guardadas o la plantilla).`,
    };
  }
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(queryTemplate ?? {})) {
    query.set(k, renderTemplate(v, vars));
  }

  const urlString = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}${query.toString() ? `?${query}` : ""}`;

  let requestUrl: URL;
  try {
    requestUrl = assertPublicHttpUrl(urlString);
    hostAllowed(requestUrl, parsedConnector, baseUrl);
  } catch (e) {
    return {
      ok: false,
      code: e instanceof Error ? e.message : "url_blocked",
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(parsedConnector.extraHeaders ?? {}),
  };
  applyAuth(parsedConnector, fieldValues, headers, query, operation);

  let body: string | undefined;
  if (bodyTemplate?.trim()) {
    body = renderTemplate(bodyTemplate, vars);
    headers["Content-Type"] = "application/json";
  }

  const secrets = collectSecrets(fieldValues);
  const res = await fetch(requestUrl.toString(), {
    method,
    headers,
    body:
      body && method !== "GET" && method !== "HEAD" ? body : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  const redacted = redactSecretsInText(text, [
    ...secrets,
    headers.Authorization,
    parsedConnector.authHeaderName
      ? headers[parsedConnector.authHeaderName]
      : undefined,
  ]);

  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(redacted);
  } catch {
    bodyJson = { _raw: redacted.slice(0, 2000) };
  }

  if (!res.ok) {
    const detail = upstreamErrorDetail(bodyJson, res.status);
    return {
      ok: false,
      code: "http_error",
      status: res.status,
      detail,
    };
  }

  const map = effectiveResponseMap(operation);
  const mapped = applyResponseMap(bodyJson, map);

  return {
    ok: true,
    status: res.status,
    mapped,
    bodyJson,
  };
}
