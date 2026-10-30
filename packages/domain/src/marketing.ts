import type { PlanSlug } from "./plans";
import { PLAN_LIMITS } from "./plans";
import { illustrativeChatsPerMonth, USAGE_METERING_COPY } from "./usage-metering";

export interface PlanMarketing {
  slug: PlanSlug;
  name: string;
  priceUsd: number;
  tagline: string;
  forWho: string;
  highlights: string[];
  overageNote: string;
}

export const PRICING_PRODUCT_LINE =
  "Todos los planes incluyen chat web y tienda hosted, mensajes de tus visitantes y créditos de procesamiento (IA, documentos e integraciones).";

export const TEAM_SEATS_LINE =
  "Cada plan incluye asientos de panel: dueño y administradores configuran web, integraciones y facturación; los agentes entran con su propio login solo al Panel (atención humana) y métricas, sin tocar la configuración técnica.";

function seatHighlight(slug: PlanSlug): string {
  const n = PLAN_LIMITS[slug].maxSeats;
  return `${n} asientos de panel (admins + agentes con login propio)`;
}

function msgHighlight(slug: PlanSlug): string {
  const n = PLAN_LIMITS[slug].monthlyMessages.toLocaleString("es");
  const chats = illustrativeChatsPerMonth(slug, 5).toLocaleString("es");
  return `${n} mensajes de visitantes al mes (≈ ${chats} chats si escriben ~5 veces)`;
}

export const PLAN_MARKETING: PlanMarketing[] = [
  {
    slug: "starter",
    name: "Starter",
    priceUsd: 99,
    tagline: "Chat web con IA que conoce tu negocio.",
    forWho:
      "Un negocio que recibe consultas en la web pero sigue contestando pedidos y stock a mano.",
    highlights: [
      msgHighlight("starter"),
      `${PLAN_LIMITS.starter.monthlyAiCredits.toLocaleString("es")} créditos de procesamiento incluidos`,
      seatHighlight("starter"),
      `Hasta ${PLAN_LIMITS.starter.maxRagSources} documentos para entrenar la IA`,
      `Historial de ${PLAN_LIMITS.starter.logRetentionDays} días`,
    ],
    overageNote: "Sin mensajes: sube de plan. Sin créditos: packs prepago en Facturación.",
  },
  {
    slug: "growth",
    name: "Growth",
    priceUsd: 199,
    tagline: "Más mensajes, más equipo y más conexiones a tu operación.",
    forWho:
      "Negocios con volumen diario en el chat web e integraciones con su tienda, ERP o CRM.",
    highlights: [
      msgHighlight("growth"),
      `${PLAN_LIMITS.growth.monthlyAiCredits.toLocaleString("es")} créditos de procesamiento`,
      seatHighlight("growth"),
      `Hasta ${PLAN_LIMITS.growth.maxRagSources} documentos para entrenar la IA`,
      `Historial de ${PLAN_LIMITS.growth.logRetentionDays} días`,
    ],
    overageNote: "Picos de temporada: créditos extra o plan superior.",
  },
  {
    slug: "business",
    name: "Business",
    priceUsd: 589,
    tagline: "Alto volumen, historial largo y capacidad máxima de integraciones.",
    forWho:
      "Equipos grandes o negocios que necesitan conservar el historial más tiempo.",
    highlights: [
      msgHighlight("business"),
      `${PLAN_LIMITS.business.monthlyAiCredits.toLocaleString("es")} créditos de procesamiento`,
      seatHighlight("business"),
      `Hasta ${PLAN_LIMITS.business.maxRagSources} documentos para entrenar la IA`,
      `Historial de ${PLAN_LIMITS.business.logRetentionDays} días`,
    ],
    overageNote: "Volumen extremo: contact@rekov.co (enterprise).",
  },
];

export const PRICING_FAQ = [
  {
    q: "¿Mensaje o conversación?",
    a: USAGE_METERING_COPY.visitorMessage + " " + USAGE_METERING_COPY.notConversationBilling,
  },
  {
    q: "¿Qué son los créditos de procesamiento?",
    a: USAGE_METERING_COPY.processingCredit + " " + USAGE_METERING_COPY.ragPerMessage,
  },
  {
    q: "¿Puedo quedarme sin cupo si el chat es largo?",
    a: USAGE_METERING_COPY.twoLimits,
  },
  {
    q: "¿Me van a cobrar de más si hay un mes fuerte?",
    a: "Cuota fija al mes por Desk. No cobramos por minuto ni por resolución. Si te pasas de mensajes, subes de plan; si te pasas de créditos, packs opcionales.",
  },
  {
    q: "¿Qué incluye el precio de Desk?",
    a: "Panel de Desk, chat web y tienda hosted, documentos de tu negocio e integraciones con tus sistemas.",
  },
  {
    q: "¿Compiten con empresas que quieren millones de chats?",
    a: "Desk está pensado para PYMEs y equipos con hasta decenas de miles de mensajes al mes (plan Business ~50k). Volúmenes de contact center masivo son otro tipo de proyecto.",
  },
  {
    q: "¿Por qué no un chatbot barato?",
    a: "Porque combina catálogo en Desk, documentos de tu negocio e integraciones opcionales — no un FAQ genérico — con precio mensual predecible y bandeja humana en el mismo chat.",
  },
  {
    q: "¿En qué moneda pago?",
    a: "USD al mes. Lo ves en el checkout antes de pagar.",
  },
  {
    q: "¿Puedo dar acceso a mi equipo sin compartir contraseña?",
    a:
      "Sí. Invitas por correo; cada persona tiene login. Los agentes atienden la bandeja; solo dueño y administradores cambian integraciones, documentos y facturación. Las acciones relevantes quedan en el registro de actividad.",
  },
];

export const PRICING_CURRENCY_NOTE =
  "USD/mes · chat web hosted · mensajes y créditos según cada plan.";
