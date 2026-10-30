import { z } from "zod";
import { commercePaymentProvidersSchema } from "./commerce-payment-webhook";

export const commerceOnboardingProfileSchema = z.object({
  sellsOnline: z.boolean().optional(),
  catalogSource: z
    .enum(["create", "import_pdf", "import_curl", "api", "files"])
    .optional(),
  paymentConfirmation: z.enum(["manual", "automatic"]).optional(),
  channels: z.array(z.enum(["web"])).max(4).optional(),
  completedAt: z.string().max(40).optional(),
});

export const paymentInstructionsSchema = z.object({
  bankName: z.string().max(120).optional(),
  accountNumber: z.string().max(80).optional(),
  accountHolder: z.string().max(120).optional(),
  accountType: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
  paymentLink: z.string().url().max(2048).optional(),
});

export const commerceManifestSchema = z.object({
  currency: z.string().max(8).default("USD"),
  mode: z.enum(["order_only", "checkout_link"]).default("order_only"),
  confirmationMode: z.enum(["manual", "automatic"]).default("automatic"),
  commerceProfile: z.enum(["product_sales", "support_only"]).default("product_sales"),
  paymentInstructions: paymentInstructionsSchema.optional(),
  /** Base pública del panel (ej. https://desk.rekov.co) para enlaces /o/{ref}. */
  orderPageBaseUrl: z.string().url().max(2048).optional(),
  /** Teléfono o contacto del negocio (opcional) para enlaces post-pago. */
  checkoutReturnPhone: z.string().max(32).optional(),
  onboardingProfile: commerceOnboardingProfileSchema.optional(),
  /** Catálogo nativo Desk (sin backend): productos, stock y venta en chat. */
  nativeInventoryEnabled: z.boolean().optional(),
  paymentProviders: commercePaymentProvidersSchema.optional(),
  buyerFields: z
    .object({
      natural_person: z.array(z.string()).optional(),
      company: z.array(z.string()).optional(),
    })
    .optional(),
});

export type CommerceManifest = z.infer<typeof commerceManifestSchema>;

export function parseCommerceManifest(raw: string | null | undefined): CommerceManifest {
  if (!raw?.trim()) {
    return commerceManifestSchema.parse({});
  }
  try {
    const parsed = commerceManifestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : commerceManifestSchema.parse({});
  } catch {
    return commerceManifestSchema.parse({});
  }
}
