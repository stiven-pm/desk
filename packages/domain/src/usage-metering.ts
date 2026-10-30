import { PLAN_LIMITS, type PlanSlug } from "./plans";

/** Extra RAG (embed + Vectorize) billed in Desk credits per visitor message. */
export const RAG_METERING_CREDITS_PER_MESSAGE = 3;

/**
 * Canonical metering (must match runtime + platform-api usage.ts / do-usage.ts).
 *
 * - monthlyMessages limit → usage_counters.messages_count (+1 per visitor user turn)
 * - monthlyAiCredits limit → ai + setup + rag metered credits (wallet after plan cupo)
 */

/** Short label for pricing tables (Spanish). */
export const METER_VISITOR_MESSAGES_LABEL = "Mensajes de tus clientes / mes";

/** Short label for processing quota (Spanish). */
export const METER_PROCESSING_CREDITS_LABEL = "Créditos de procesamiento / mes";

export const USAGE_METERING_COPY = {
  visitorMessage:
    "Cada vez que un visitante escribe en tu chat web (un turno suyo). Diez mensajes en el mismo hilo = diez mensajes.",
  processingCredit:
    "Presupuesto de procesamiento: modelo de lenguaje, búsqueda en documentos y uso de herramientas. Un mensaje puede consumir varios créditos si la respuesta es larga o consulta sistemas.",
  ragPerMessage: `Cada mensaje del cliente suma ${RAG_METERING_CREDITS_PER_MESSAGE} créditos de búsqueda en documentos (además del chat).`,
  twoLimits:
    "Puedes quedarte sin mensajes o sin créditos primero, según el uso. Los packs prepago solo cubren créditos, no mensajes.",
  notConversationBilling:
    "Hoy no cobramos por “sesión” o “conversación cerrada”; el tope duro en código es por mensaje del visitante.",
} as const;

/** Rough planning: typical credits per visitor message (chat + RAG), not a guarantee. */
export const TYPICAL_CREDITS_PER_VISITOR_MESSAGE = {
  light: 8,
  typical: 14,
  heavy: 28,
} as const;

export function estimateCreditsForVisitorMessages(
  messageCount: number,
  profile: keyof typeof TYPICAL_CREDITS_PER_VISITOR_MESSAGE = "typical",
): number {
  const per = TYPICAL_CREDITS_PER_VISITOR_MESSAGE[profile];
  return messageCount * (per + RAG_METERING_CREDITS_PER_MESSAGE);
}

/** Illustrative chats/month if each chat has `messagesPerChat` visitor turns. */
export function illustrativeChatsPerMonth(
  plan: PlanSlug,
  messagesPerChat = 5,
): number {
  const cap = PLAN_LIMITS[plan].monthlyMessages;
  return Math.floor(cap / Math.max(1, messagesPerChat));
}
