import type { ToolParameter } from "./types";

type OpenApiSpec = {
  openapi?: string;
  swagger?: string;
  paths?: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in?: string;
          required?: boolean;
          description?: string;
          schema?: Record<string, unknown>;
        }>;
        requestBody?: {
          content?: Record<string, { schema?: Record<string, unknown> }>;
        };
      }
    >
  >;
};

const METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
]);

export function parseOpenApiSpec(raw: string | Record<string, unknown>): {
  tools: Array<{
    name: string;
    description: string;
    method: string;
    path: string;
    parameters: ToolParameter[];
  }>;
  error?: string;
} {
  let spec: OpenApiSpec;
  try {
    spec =
      typeof raw === "string"
        ? (JSON.parse(raw) as OpenApiSpec)
        : (raw as OpenApiSpec);
  } catch {
    return { tools: [], error: "invalid_json" };
  }
  if (!spec.paths) return { tools: [], error: "missing_paths" };

  const tools: Array<{
    name: string;
    description: string;
    method: string;
    path: string;
    parameters: ToolParameter[];
  }> = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!METHODS.has(method)) continue;
      const name =
        op.operationId ??
        `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
      const parameters: ToolParameter[] = (op.parameters ?? []).map((p) => ({
        name: p.name,
        in: (p.in === "path" || p.in === "query" ? p.in : "query") as
          | "path"
          | "query",
        description: p.description,
        required: p.required,
        schema: p.schema,
      }));
      const bodySchema =
        op.requestBody?.content?.["application/json"]?.schema;
      if (bodySchema) {
        parameters.push({
          name: "body",
          in: "body",
          description: "JSON body",
          required: method !== "get",
          schema: bodySchema,
        });
      }
      tools.push({
        name: safeName,
        description:
          op.description?.slice(0, 500) ??
          op.summary?.slice(0, 500) ??
          `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        parameters,
      });
    }
  }
  return { tools };
}

export function parametersToJsonSchema(
  parameters: ToolParameter[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of parameters) {
    if (p.in === "body") continue;
    properties[p.name] = p.schema ?? { type: "string" };
    if (p.required) required.push(p.name);
  }
  const body = parameters.find((p) => p.in === "body");
  if (body) {
    properties.body = body.schema ?? { type: "object" };
    if (body.required) required.push("body");
  }
  return {
    type: "object",
    properties,
    required: required.length ? required : undefined,
    additionalProperties: false,
  };
}
