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
  "Menos consultas repetidas en tu web: IA con tus documentos, checkout cuando aplica e integración a tus sistemas con setup inicial en todos los planes — precio mensual fijo.";

export const INTEGRATIONS_SETUP_LINE =
  "Cada empresa conecta sus propios sistemas (API, MCP, conectores o tienda Desk). Incluimos setup inicial en Starter, Growth y Business hasta dejar operativa la primera conexión acordada contigo.";

export const AVAILABILITY_LINE =
  "Disponibilidad en best effort: sin SLA de uptime en planes estándar; el servicio depende principalmente de Cloudflare (Workers, D1, Workers AI).";

export const SERVICE_CREDIT_LINE =
  "Si un incidente nuestro te afectó de forma relevante, podemos acreditar créditos de wallet a criterio de Rekov (impacto, duración, historial) — no hay tabla automática en self-serve; enterprise puede pactar reglas por escrito.";

export const TEAM_SEATS_LINE =
  "Asientos de panel incluidos: admins configuran; agentes solo bandeja y métricas.";

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
    tagline: "Deja de responder lo mismo en la web.",
    forWho:
      "Un negocio con consultas de pedidos, stock o horarios que hoy caen en WhatsApp o correo.",
    highlights: [
      msgHighlight("starter"),
      "Setup inicial de integración con tu stack",
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
    tagline: "Volumen diario en la web y datos de tu operación conectados.",
    forWho:
      "Equipos que ya usan el chat a diario y necesitan ERP, tienda o API en las respuestas.",
    highlights: [
      msgHighlight("growth"),
      "Setup inicial de integración con tu stack",
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
    tagline: "Alto volumen, historial largo, integraciones al tope.",
    forWho:
      "Equipos grandes con mucho tráfico en el chat web y conexiones exigentes a su operación.",
    highlights: [
      msgHighlight("business"),
      "Setup inicial de integración con tu stack",
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
    a: "Chat web hosted, panel, bandeja humana, documentos para la IA, tienda/checkout Desk, integraciones según plan y setup inicial con tus sistemas en todos los planes.",
  },
  {
    q: "¿Cómo funcionan las integraciones?",
    a: INTEGRATIONS_SETUP_LINE,
  },
  {
    q: "¿Hay SLA de disponibilidad?",
    a: AVAILABILITY_LINE + " Detalle: /legal/disponibilidad. Uptime garantizado solo bajo contrato enterprise.",
  },
  {
    q: "¿Compensan con créditos si hay caídas?",
    a: SERVICE_CREDIT_LINE,
  },
  {
    q: "¿Enlace y widget son chats distintos?",
    a: "No. Es el mismo chat de tu empresa: el enlace hosted y el botón en tu web abren la misma IA y documentos.",
  },
  {
    q: "¿Compiten con empresas que quieren millones de chats?",
    a: "Desk está pensado para PYMEs y equipos con hasta decenas de miles de mensajes al mes (plan Business ~50k). Volúmenes de contact center masivo son otro tipo de proyecto.",
  },
  {
    q: "¿Por qué no un chatbot barato?",
    a: "Porque resuelve pedidos y políticas con tus documentos y sistemas — y un humano puede tomar el hilo — con un tope mensual claro, no un FAQ genérico.",
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
