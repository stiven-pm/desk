import { z } from "zod";

export const integrationFieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  secret: z.boolean().default(false),
  required: z.boolean().default(true),
  placeholder: z.string().max(256).optional(),
});

export type IntegrationFieldDef = z.infer<typeof integrationFieldSchema>;

export const integrationDefinitionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["payment", "commerce", "api", "other"]),
  description: z.string().nullable().optional(),
  fields: z.array(integrationFieldSchema),
  status: z.enum(["active", "archived"]),
});

export type IntegrationDefinition = z.infer<typeof integrationDefinitionSchema>;

export function parseIntegrationFields(json: string | null): IntegrationFieldDef[] {
  if (!json?.trim()) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((f) => integrationFieldSchema.safeParse(f))
      .filter((r) => r.success)
      .map((r) => r.data!);
  } catch {
    return [];
  }
}
