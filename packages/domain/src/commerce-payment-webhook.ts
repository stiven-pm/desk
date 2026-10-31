import { z } from "zod";
import {
  parseDeclarativeWebhook,
  type PaymentProfile,
} from "./integration-capabilities";
import { looksLikeWompiEvent, verifyWompiEventChecksum } from "./wompi-event-checksum";

/** Secret sincronizado desde la plantilla de pago al activar Integraciones. */
export const commercePaymentProvidersSchema = z.object({
  genericWebhookSecret: z.string().max(256).optional(),
});

export type CommercePaymentProviderSecrets = z.infer<
  typeof commercePaymentProvidersSchema
>;

export type PaymentWebhookProvider = "declarative";

export function paymentWebhookSecret(
  secrets: CommercePaymentProviderSecrets | undefined,
): string | undefined {
  return secrets?.genericWebhookSecret?.trim() || undefined;
}

export function hasPaymentWebhookSecret(
  secrets: CommercePaymentProviderSecrets | undefined,
): boolean {
  return Boolean(paymentWebhookSecret(secrets));
}

export type ParsedPaymentWebhook = {
  eventId: string;
  orderReference: string | null;
  status: "paid" | "failed" | "ignored";
  rawStatus?: string;
};

export function parsePaymentWebhook(
  provider: PaymentWebhookProvider,
  body: unknown,
  declarativeProfile: PaymentProfile,
): ParsedPaymentWebhook {
  if (provider !== "declarative") {
    return {
      eventId: "unknown",
      orderReference: null,
      status: "ignored",
    };
  }
  return parseDeclarativeWebhook(body, declarativeProfile);
}

export type WebhookAuthInput = {
  provider: PaymentWebhookProvider;
  secrets: CommercePaymentProviderSecrets;
  bearerToken?: string | null;
  body?: unknown;
  eventChecksumHeader?: string | null;
};

/** Automático: Bearer genérico o checksum Wompi (X-Event-Checksum). */
export async function verifyPaymentWebhookAuth(
  input: WebhookAuthInput,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const secret = paymentWebhookSecret(input.secrets);
  if (!secret) {
    return { ok: false, code: "provider_secret_not_configured" };
  }
  const token = (input.bearerToken ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token && token === secret) {
    return { ok: true };
  }
  if (input.body && looksLikeWompiEvent(input.body)) {
    const ok = await verifyWompiEventChecksum(
      input.body,
      secret,
      input.eventChecksumHeader,
    );
    if (ok) return { ok: true };
    return { ok: false, code: "invalid_signature" };
  }
  if (token) {
    return { ok: false, code: "invalid_signature" };
  }
  return { ok: false, code: "invalid_signature" };
}
