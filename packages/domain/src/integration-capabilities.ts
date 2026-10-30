import { z } from "zod";

/** Standard Desk router capabilities (v2 names). */
export const STANDARD_INTEGRATION_CAPABILITIES = [
  "catalog.search",
  "catalog.get",
  "stock.check",
  "order.create",
  "order.status",
  "payment.create_link",
  "payment.verify",
] as const;

export type StandardIntegrationCapability =
  (typeof STANDARD_INTEGRATION_CAPABILITIES)[number];

const LEGACY_CAPABILITY_MAP: Record<string, StandardIntegrationCapability> = {
  "payment.create_checkout": "payment.create_link",
  "payment.get_status": "payment.verify",
  "catalog.list_products": "catalog.search",
  "catalog.get_product": "catalog.get",
  "order.get_status": "order.status",
};

export const integrationCapabilitySchema = z.union([
  z.enum(STANDARD_INTEGRATION_CAPABILITIES),
  z.literal("custom"),
]);

export type IntegrationCapability = z.infer<typeof integrationCapabilitySchema>;

export function normalizeIntegrationCapability(
  cap: string,
): IntegrationCapability {
  const trimmed = cap.trim();
  if (trimmed === "custom") return "custom";
  const legacy = LEGACY_CAPABILITY_MAP[trimmed];
  if (legacy) return legacy;
  const parsed = integrationCapabilitySchema.safeParse(trimmed);
  if (parsed.success) return parsed.data;
  return "custom";
}

/** Capabilities that may satisfy a standard router slot (new + legacy DB values). */
export function capabilityMatchKeys(
  standard: StandardIntegrationCapability,
): string[] {
  const legacy = Object.entries(LEGACY_CAPABILITY_MAP)
    .filter(([, v]) => v === standard)
    .map(([k]) => k);
  return [standard, ...legacy];
}

export const connectorAuthTypeSchema = z.enum([
  "none",
  "bearer",
  "header",
  "basic",
  "query",
]);

export const connectorConfigSchema = z.object({
  baseUrl: z.string().max(2048).optional(),
  allowedHosts: z.array(z.string().max(253)).max(8).optional(),
  authType: connectorAuthTypeSchema.default("none"),
  /** Field key in org integration values for bearer/header/basic password/query token */
  authFieldKey: z.string().max(64).optional(),
  authHeaderName: z.string().max(64).optional(),
  /** Second field for basic auth username */
  basicUserFieldKey: z.string().max(64).optional(),
  extraHeaders: z.record(z.string().max(256)).optional(),
});

export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;

export const paramOriginSchema = z.enum([
  "ai",
  "config",
  "secret",
  "ctx",
  "fixed",
  "computed",
]);

export type ParamOrigin = z.infer<typeof paramOriginSchema>;

export const computedParamKindSchema = z.enum([
  "cart_total",
  "order.reference",
]);

export const operationParamSchema = z.object({
  key: z.string().min(1).max(64),
  origin: paramOriginSchema,
  label: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
  configKey: z.string().max(64).optional(),
  ctxKey: z.string().max(64).optional(),
  fixedValue: z.string().max(2048).optional(),
  computed: computedParamKindSchema.optional(),
  /** JSON-schema-like fragment for AI args (type, enum, minimum, …) */
  schema: z.record(z.unknown()).optional(),
});

export type OperationParamDef = z.infer<typeof operationParamSchema>;

export const operationRequestSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    .optional(),
  path: z.string().max(2048).optional(),
  query: z.record(z.string().max(512)).optional(),
  body: z.string().max(8192).optional(),
});

export type OperationRequest = z.infer<typeof operationRequestSchema>;

export const responseMapSchema = z.object({
  /** dotted paths from parsed JSON body, e.g. checkoutUrl: "data.payment_link_url" */
  fields: z.record(z.string().max(128)).default({}),
  /** For catalog.search: path to array of items */
  itemsPath: z.string().max(128).optional(),
  maxItems: z.number().int().min(1).max(200).optional(),
  /** Per-item field mapping */
  itemFields: z
    .object({
      productId: z.string().max(64).optional(),
      name: z.string().max(64).optional(),
      priceCents: z.string().max(64).optional(),
      currency: z.string().max(64).optional(),
      stock: z.string().max(64).optional(),
    })
    .optional(),
});

export type ResponseMap = z.infer<typeof responseMapSchema>;

export const integrationOperationSchema = z.object({
  id: z.string().optional(),
  capability: integrationCapabilitySchema,
  slug: z.string().min(1).max(64),
  /** LLM function name; unique per definition version when set */
  toolName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .optional(),
  description: z.string().max(2000).optional(),
  params: z.array(operationParamSchema).max(64).default([]),
  request: operationRequestSchema.optional(),
  response: responseMapSchema.default({ fields: {} }),
  /** @deprecated use request.path */
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
  pathTemplate: z.string().min(1).max(2048).optional(),
  bodyTemplate: z.string().max(8192).optional(),
  queryTemplate: z.record(z.string().max(512)).default({}),
  responseMap: responseMapSchema.default({ fields: {} }),
  exposeToAi: z.boolean().default(false),
  sideEffect: z.enum(["read", "write"]).default("read"),
  requiresConfirm: z.boolean().default(false),
  /** inherit = connector auth; none = no auth header; bearer_field = Bearer from authFieldKey */
  authMode: z.enum(["inherit", "none", "bearer_field"]).default("inherit"),
  authFieldKey: z.string().max(64).optional(),
  testArgs: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export type IntegrationOperationDef = z.infer<typeof integrationOperationSchema>;

export function effectiveOperationRequest(
  op: IntegrationOperationDef,
): {
  method: IntegrationOperationDef["method"];
  pathTemplate: string;
  bodyTemplate?: string;
  queryTemplate: Record<string, string>;
} {
  const req = op.request;
  const pathTemplate =
    req?.path?.trim() || op.pathTemplate?.trim() || "/";
  const method = req?.method ?? op.method;
  const queryTemplate = req?.query ?? op.queryTemplate ?? {};
  const bodyTemplate = req?.body ?? op.bodyTemplate;
  return { method, pathTemplate, bodyTemplate, queryTemplate };
}

export function effectiveResponseMap(op: IntegrationOperationDef): ResponseMap {
  const r = op.response;
  const legacy = op.responseMap;
  if (r && (Object.keys(r.fields ?? {}).length || r.itemsPath)) return r;
  return legacy ?? { fields: {} };
}

export const paidWhenRuleSchema = z.object({
  statusPath: z.string().max(256).optional(),
  referencePath: z.string().max(256).optional(),
  amountPath: z.string().max(256).optional(),
  statusValues: z.array(z.string().max(64)).max(32).optional(),
});

export const paymentWebhookAuthSchema = z.object({
  type: z.enum(["bearer", "none"]).default("bearer"),
  /** org field key whose value is compared to Authorization bearer */
  secretFieldKey: z.string().max(64).optional(),
});

export const paymentProfileSchema = z.object({
  webhookAuth: paymentWebhookAuthSchema.default({ type: "bearer" }),
  referenceJsonPath: z.string().max(256).optional(),
  eventIdJsonPath: z.string().max(256).optional(),
  statusJsonPath: z.string().max(256).optional(),
  paidStatusValues: z.array(z.string().max(64)).max(32).optional(),
  paidWhen: paidWhenRuleSchema.optional(),
  /** Additional JSON paths tried for inbound payment reference */
  inboundReferencePaths: z.array(z.string().max(256)).max(16).optional(),
  /** Sync events secret to commerce manifest genericWebhookSecret */
  syncGenericWebhookSecret: z.boolean().default(true),
});

export type PaymentProfile = z.infer<typeof paymentProfileSchema>;

export const declarativeCredentialsSchema = z.object({
  instanceId: z.string().min(8).max(64),
  definitionId: z.string().min(8).max(64),
});

export type DeclarativeCredentials = z.infer<typeof declarativeCredentialsSchema>;

/** Get nested value by dotted path; supports `items[0].id`. */
export function getJsonPath(root: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  const tokens: string[] = [];
  const re = /[^.[\]]+|\[\d+\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    tokens.push(m[0]);
  }
  let cur: unknown = root;
  for (const token of tokens) {
    if (cur == null) return undefined;
    if (token.startsWith("[") && token.endsWith("]")) {
      const idx = Number(token.slice(1, -1));
      if (!Array.isArray(cur) || !Number.isInteger(idx)) return undefined;
      cur = cur[idx];
      continue;
    }
    if (typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[token];
  }
  return cur;
}

export function applyResponseMap(
  bodyJson: unknown,
  map: ResponseMap,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(map.fields ?? {})) {
    const v = getJsonPath(bodyJson, path);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

export type ParamResolveContext = {
  fieldValues: Record<string, string>;
  ai: Record<string, string>;
  ctx: Record<string, string>;
  computed: {
    cartTotalCents?: string;
    orderReference?: string;
  };
};

export function resolveOperationParams(
  params: OperationParamDef[],
  ctx: ParamResolveContext,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const p of params) {
    let val = "";
    switch (p.origin) {
      case "ai":
        val = ctx.ai[p.key] ?? "";
        break;
      case "config":
      case "secret":
        val = ctx.fieldValues[p.configKey ?? p.key] ?? "";
        break;
      case "fixed":
        val = p.fixedValue ?? "";
        break;
      case "ctx":
        val = ctx.ctx[p.ctxKey ?? p.key] ?? "";
        break;
      case "computed":
        if (p.computed === "cart_total") {
          val = ctx.computed.cartTotalCents ?? "";
        } else if (p.computed === "order.reference") {
          val = ctx.computed.orderReference ?? "";
        }
        break;
      default:
        break;
    }
    vars[`${p.origin}.${p.key}`] = val;
    vars[p.key] = val;
  }
  return vars;
}

function schemaType(
  schema: Record<string, unknown> | undefined,
): string | undefined {
  const t = schema?.type;
  return typeof t === "string" ? t : undefined;
}

/** Validate AI-origin params; secrets never accepted from LLM args. */
export function validateIntegrationAiArgs(
  params: OperationParamDef[],
  args: Record<string, unknown>,
): { ok: true; values: Record<string, string> } | { ok: false; code: string } {
  const values: Record<string, string> = {};
  for (const p of params) {
    if (p.origin !== "ai") continue;
    const raw = args[p.key];
    if (raw === undefined || raw === null || raw === "") {
      if (p.required) return { ok: false, code: `missing_${p.key}` };
      continue;
    }
    const t = schemaType(p.schema);
    if (t === "integer" || t === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, code: `invalid_${p.key}` };
      const min = p.schema?.minimum;
      if (typeof min === "number" && n < min) {
        return { ok: false, code: `invalid_${p.key}` };
      }
      values[p.key] = String(Math.trunc(n));
    } else if (t === "boolean") {
      values[p.key] = raw === true || raw === "true" ? "true" : "false";
    } else {
      const s = String(raw).slice(0, 4096);
      const enumVals = p.schema?.enum;
      if (Array.isArray(enumVals) && enumVals.length) {
        if (!enumVals.map(String).includes(s)) {
          return { ok: false, code: `invalid_${p.key}` };
        }
      }
      values[p.key] = s;
    }
  }
  return { ok: true, values };
}

export function buildLlmInputSchemaFromParams(
  params: OperationParamDef[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    if (p.origin !== "ai") continue;
    properties[p.key] = {
      type: schemaType(p.schema) ?? "string",
      description: (p.description ?? p.label ?? p.key).slice(0, 500),
      ...(p.schema ?? {}),
    };
    if (p.required) required.push(p.key);
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

export function integrationOperationLlmName(
  op: IntegrationOperationDef,
): string {
  return (op.toolName?.trim() || op.slug.trim()).slice(0, 64);
}

export function parseDeclarativeWebhook(
  body: unknown,
  profile: PaymentProfile,
): {
  eventId: string;
  orderReference: string | null;
  status: "paid" | "failed" | "ignored";
  rawStatus?: string;
} {
  const root = body as Record<string, unknown>;
  const paidWhen = profile.paidWhen;
  const statusPath =
    paidWhen?.statusPath ?? profile.statusJsonPath ?? undefined;
  const statusRaw = statusPath
    ? String(getJsonPath(body, statusPath) ?? "")
    : String(root.status ?? root.event ?? root.type ?? "");

  const refPaths = [
    ...(paidWhen?.referencePath ? [paidWhen.referencePath] : []),
    ...(profile.inboundReferencePaths ?? []),
    ...(profile.referenceJsonPath ? [profile.referenceJsonPath] : []),
  ];
  let ref: string | null = null;
  for (const p of refPaths) {
    const v = getJsonPath(body, p);
    if (typeof v === "string" && v.trim()) {
      ref = v.trim();
      break;
    }
  }

  const eventId = profile.eventIdJsonPath
    ? String(getJsonPath(body, profile.eventIdJsonPath) ?? "").slice(0, 120)
    : String(root.id ?? `${ref ?? "na"}-${statusRaw}`).slice(0, 120);

  const paidValues =
    paidWhen?.statusValues ?? profile.paidStatusValues ?? [];
  const s = statusRaw.toLowerCase();
  const paid =
    paidValues.some((v) => s === v.toLowerCase()) ||
    s.includes("approved") ||
    s.includes("paid") ||
    s.includes("success") ||
    s === "sale" ||
    s === "completed";

  const failed =
    !paid &&
    (s.includes("declined") ||
      s.includes("failed") ||
      s.includes("rejected") ||
      s.includes("voided") ||
      s.includes("error"));

  return {
    eventId,
    orderReference: ref,
    status: paid ? "paid" : failed ? "failed" : "ignored",
    rawStatus: statusRaw,
  };
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}
