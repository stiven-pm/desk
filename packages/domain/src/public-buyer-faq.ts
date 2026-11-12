import { PLAN_LIMITS, type PlanSlug } from "./plans";
import { TRIAL_DURATION_DAYS } from "./trial";
import {
  RAG_METERING_CREDITS_PER_MESSAGE,
  TYPICAL_CREDITS_PER_VISITOR_MESSAGE,
  USAGE_METERING_COPY,
} from "./usage-metering";

/** Plain-language answers for buyers, evaluators, and search/AI crawlers. */
export function planMeteringExplanation(slug: PlanSlug): string {
  const L = PLAN_LIMITS[slug];
  const typicalPerMsg =
    TYPICAL_CREDITS_PER_VISITOR_MESSAGE.typical + RAG_METERING_CREDITS_PER_MESSAGE;
  const heavyPerMsg =
    TYPICAL_CREDITS_PER_VISITOR_MESSAGE.heavy + RAG_METERING_CREDITS_PER_MESSAGE;
  const capByMsgs = L.monthlyMessages;
  const capByCreditsTypical = Math.floor(L.monthlyAiCredits / typicalPerMsg);
  const capByCreditsHeavy = Math.floor(L.monthlyAiCredits / heavyPerMsg);
  const practicalTypical = Math.min(capByMsgs, capByCreditsTypical);
  return (
    `Plan ${slug.charAt(0).toUpperCase() + slug.slice(1)}: tope de ${capByMsgs.toLocaleString("es")} mensajes de visitantes al mes ` +
    `y ${L.monthlyAiCredits.toLocaleString("es")} créditos de procesamiento al mes — aplica lo que se agote primero. ` +
    `Cada mensaje del visitante suma ${RAG_METERING_CREDITS_PER_MESSAGE} créditos de búsqueda en documentos más el chat ` +
    `(respuesta típica ~${TYPICAL_CREDITS_PER_VISITOR_MESSAGE.typical} créditos; con herramientas/ERP puede ser ~${TYPICAL_CREDITS_PER_VISITOR_MESSAGE.heavy} o más). ` +
    `Orden de magnitud: uso típico ≈ ${practicalTypical.toLocaleString("es")} mensajes/mes; uso muy pesado puede agotar créditos antes (~${capByCreditsHeavy.toLocaleString("es")} mensajes). ` +
    USAGE_METERING_COPY.twoLimits
  );
}

export const PUBLIC_BUYER_FAQ: { id: string; q: string; a: string }[] = [
  {
    id: "producto",
    q: "¿Qué vende Desk hoy?",
    a:
      "Un chat web por empresa (enlace hosted en desk.rekov.co y/o widget en tu web), mismo hilo e IA. Incluye catálogo nativo con carrito y pago en el chat, documentos/PDFs para respuestas, bandeja humana, integraciones opcionales a tu ERP/tienda/API con setup inicial en todos los planes, y equipo con permisos. No es WhatsApp ni voz operados por Desk.",
  },
  {
    id: "prueba-gratis",
    q: `¿Hay prueba gratis de ${TRIAL_DURATION_DAYS} días?`,
    a:
      `Sí: al crear cuenta tienes ${TRIAL_DURATION_DAYS} días con panel, chat hosted/widget, documentos e integraciones con cupos reducidos (1 asiento, sin tarjeta). Luego eliges Starter, Growth o Business en /dashboard/billing. Los topes de la prueba son menores que los del plan de pago; detalle: ${planMeteringExplanation("trial")}`,
  },
  {
    id: "pagos-desk",
    q: "¿Qué pasarela cobra la suscripción de Desk?",
    a:
      "La cuota mensual del plan (Starter/Growth/Business) y los packs de créditos se pagan con Creem (procesador de pagos en USD). Los métodos disponibles dependen de Creem en el checkout (tarjeta internacional; consulta el checkout antes de pagar). Desk no guarda el número completo de tarjeta.",
  },
  {
    id: "pagos-tus-clientes",
    q: "¿Qué pasarela usa el checkout cuando mis clientes me compran en el chat?",
    a:
      "Es independiente de la factura de Desk: tú configuras tu pasarela en integraciones (por ejemplo Wompi u otra vía enlace de pago/API). Desk genera el pedido y el enlace según lo que conectes. Comisiones y métodos (PSE, Nequi, tarjeta, etc.) son los de tu proveedor de pagos, no un recargo extra de Desk sobre cada venta.",
  },
  {
    id: "mensajes-vs-creditos",
    q: "¿Siempre puedo usar todos los mensajes del plan?",
    a:
      "No necesariamente. Hay dos topes: mensajes de visitantes y créditos de procesamiento; aplica el que se agote primero. En Starter, con uso típico, suele limitar primero el tope de mensajes. En Growth y Business, con integraciones o respuestas largas, los créditos pueden agotarse antes que el número de mensajes publicado. Detalle numérico en las respuestas de créditos más abajo.",
  },
  {
    id: "creditos-starter",
    q: "¿Cuántos mensajes caben en los créditos del Starter?",
    a: planMeteringExplanation("starter"),
  },
  {
    id: "creditos-growth",
    q: "¿Cuántos mensajes caben en Growth y Business?",
    a: `${planMeteringExplanation("growth")} ${planMeteringExplanation("business")}`,
  },
  {
    id: "tope-mensajes",
    q: "¿Qué pasa si llego al tope de mensajes o créditos?",
    a:
      "El chat de tus visitantes deja de aceptar nuevos mensajes hasta el siguiente periodo mensual o hasta que subas de plan (mensajes) o compres créditos en wallet (solo créditos, no mensajes). El panel sigue accesible para administradores. No hay cobro automático por mensaje extra.",
  },
  {
    id: "reembolsos",
    q: "¿Hay reembolsos y cómo cancelo?",
    a:
      "Salvo ley imperativa de consumo, las cuotas son no reembolsables (periodo en curso, créditos no usados y wallet). Cancelas la renovación en el portal de facturación o por escrito a contact@rekov.co; deja de renovarse el mes siguiente. Texto legal: /terminos#facturacion.",
  },
  {
    id: "sla",
    q: "¿Hay SLA de disponibilidad?",
    a: "Disponibilidad en best effort: sin SLA de uptime en planes estándar; el servicio depende principalmente de Cloudflare (Workers, D1, Workers AI). Detalle: /legal/disponibilidad. Si un incidente nuestro te afectó, podemos acreditar créditos de wallet a criterio Rekov — no hay tabla automática en self-serve.",
  },
  {
    id: "datos-cancelacion",
    q: "¿Qué pasa con mis datos si cancelo?",
    a:
      "Cuenta y conversaciones se conservan según retención del plan y plazo razonable posterior (legal, fiscal, disputas). Puedes exportar o pedir borrado en privacy@rekov.co. Copias en infra cloud pueden persistir un tiempo limitado. Detalle: /privacidad#retencion y /privacidad#derechos.",
  },
  {
    id: "ia-proveedor",
    q: "¿Qué proveedor de IA usan y dónde se procesan los datos?",
    a:
      "Inferencia y búsqueda en documentos en Cloudflare Workers AI; datos en tránsito y en reposo en infra Cloudflare (D1, R2, edge global); puede haber procesamiento en EE. UU. y otros países donde opera Cloudflare. No usamos conversaciones ni documentos para entrenar modelos fundacionales públicos. Subencargados principales: Cloudflare y Creem. Detalle: /privacidad#ia y /privacidad#transferencias.",
  },
  {
    id: "demo",
    q: "¿Hay clientes publicados o demo?",
    a:
      "Las capturas del sitio son del producto real. Para evaluar, pide demo con tus PDFs y una integración acordada: contact@rekov.co. Tras activar plan, recibes correo para agendar setup inicial.",
  },
];
