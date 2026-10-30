import { z } from "zod";
import { declarativeCredentialsSchema } from "./integration-capabilities";

/** Checkout y webhook de pago solo vía plantilla Ops (integración declarativa). */
export const paymentProviderIdSchema = z.literal("declarative");

export type PaymentProviderId = z.infer<typeof paymentProviderIdSchema>;

export type { DeclarativeCredentials } from "./integration-capabilities";

export function parseProviderCredentials(
  provider: PaymentProviderId,
  raw: Record<string, string>,
): ReturnType<typeof declarativeCredentialsSchema.parse> {
  if (provider !== "declarative") {
    throw new Error("unknown_provider");
  }
  return declarativeCredentialsSchema.parse(raw);
}
