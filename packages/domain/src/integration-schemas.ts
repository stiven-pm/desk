import { z } from "zod";

export const upsertOpenApiConfigSchema = z.object({
  baseUrl: z.string().url().max(2048),
  spec: z.union([z.string().min(2), z.record(z.unknown())]),
  authType: z.enum(["none", "bearer", "header"]).default("none"),
  authHeaderName: z.string().max(128).optional(),
  authSecret: z.string().max(4096).optional(),
  enabled: z.boolean().optional(),
});

export const createHttpToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  description: z.string().max(2000),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  baseUrl: z.string().url().max(2048).optional(),
  path: z.string().min(1).max(2048),
  parameters: z
    .array(
      z.object({
        name: z.string().min(1).max(64),
        in: z.enum(["path", "query", "body"]),
        description: z.string().max(500).optional(),
        required: z.boolean().optional(),
        schema: z.record(z.unknown()).optional(),
      }),
    )
    .max(32)
    .default([]),
  enabled: z.boolean().optional(),
});

export const updateHttpToolSchema = createHttpToolSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "empty_update" },
);

export const upsertMcpServerSchema = z.object({
  name: z.string().min(1).max(120),
  serverUrl: z.string().url().max(2048),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export const patchMcpServerSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    serverUrl: z.string().url().max(2048).optional(),
    headers: z.record(z.string()).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty_update" });

export const upsertConnectorSchema = z.object({
  connectorKey: z.enum([
    "google_sheets",
    "hubspot",
    "shopify",
    "siigo",
    "alegra",
    "odoo",
    "woocommerce",
    "zendesk",
    "supabase",
    "postgres_proxy",
    "custom_rest",
  ]),
  config: z.record(z.unknown()),
  enabled: z.boolean().optional(),
});

export const upsertOrgCommerceSettingsSchema = z.object({
  commercePayloadKeys: z
    .array(
      z
        .string()
        .min(1)
        .max(64)
        .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    )
    .max(64)
    .optional(),
});

export const upsertOrgWebhookSchema = z.object({
  url: z.string().url().max(2048),
  secret: z.string().max(512).optional(),
  events: z
    .array(
      z.enum([
        "conversation.created",
        "conversation.message",
        "conversation.handoff",
        "conversation.closed",
        "commerce.intent",
      ]),
    )
    .min(1)
    .default(["conversation.handoff"]),
  enabled: z.boolean().optional(),
});
