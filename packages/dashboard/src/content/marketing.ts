import { PLAN_LIMITS } from "@chatbot/domain";

export const MARKETING_TAGLINE =
  "Cada minuto que tu equipo repite precios, políticas y el mismo saludo en el chat es margen que no recuperas. Desk responde con tu catálogo, tus documentos y tu bandeja cuando hace falta un humano.";

export const homeHeroStats = [
  { value: "Chat web", label: "Enlace y tienda en desk.rekov.co" },
  { value: "24/7", label: "Responde sin turno extra" },
  {
    value: PLAN_LIMITS.growth.monthlyMessages.toLocaleString("es"),
    label: "Mensajes/mes en Growth",
  },
  { value: "Tus datos", label: "Documentos y sistemas conectados" },
];

export const plataformaHeroStats = [
  { value: "Hosted", label: "Catálogo + checkout + chat" },
  { value: "PDF + API", label: "Documentos y datos en vivo" },
  {
    value: PLAN_LIMITS.business.monthlyMessages.toLocaleString("es"),
    label: "Mensajes/mes en Business",
  },
  { value: "Tu tono", label: "Reglas y límites que defines" },
];

export const useCases = [
  {
    title: "Cierra ventas que se enfrían",
    body: "El que escribe a las 11 p.m. recibe respuesta en tu chat — no mañana cuando ya compró en otro lado.",
  },
  {
    title: "Baja la presión en soporte",
    body: "Horarios, garantías y preguntas frecuentes salen de tus PDFs e instrucciones; el equipo entra cuando el cliente pide una persona.",
  },
  {
    title: "Un solo criterio",
    body: "Mismo tono, mismas políticas, mismos datos en cada conversación.",
  },
  {
    title: "Picos sin contratar a gritos",
    body: "Temporada, campaña o lanzamiento: el volumen sube; la cuota del plan, no.",
  },
];

export const howDeskWorksSteps = [
  {
    step: "01",
    title: "Menos “¿me confirmas?” internos",
    body: "El cliente pregunta una vez; la respuesta sale de tus documentos y sistemas.",
  },
  {
    step: "02",
    title: "Catálogo y pedidos en el mismo chat",
    body: "Productos en Desk, carrito, enlace de pago y consultas a tu tienda o ERP — con setup inicial de integración incluido en tu plan.",
  },
  {
    step: "03",
    title: "Tu marca, no un robot genérico",
    body: "Defines tono, saludo y qué se puede prometer y qué no.",
  },
  {
    step: "04",
    title: "Enlace y tienda listos",
    body: "Publicas tu URL de chat y catálogo sin montar infraestructura propia.",
  },
  {
    step: "05",
    title: "Equipo con permisos claros",
    body: "Invita agentes al Panel; tú controlas configuración e integraciones. Cada login queda registrado.",
  },
  {
    step: "06",
    title: "Costo que cabe en el presupuesto",
    body: "Sabes el tope mensual antes de vender un cliente más.",
  },
];

export const trustPoints = [
  {
    title: "Sin factura sorpresa",
    body: "Cuota mensual publicada. No cobramos por minuto ni por “resolución”.",
  },
  {
    title: "Tus datos, tu cuenta",
    body: "Tu operación no se mezcla con la de otro cliente.",
  },
  {
    title: "Tú pones los límites",
    body: "Indica qué temas no debe tratar la IA (reclamos delicados, negociación) y qué responder en esos casos.",
  },
  {
    title: "Sube de plan cuando creces",
    body: "Más mensajes y más usuarios en el panel — sin cambiar de herramienta.",
  },
];

export const liveDataFlow = [
  { label: "Cliente", detail: "“¿Qué combos tienen y cuánto cuesta?”" },
  { label: "Desk", detail: "Catálogo + documentos + integración (si la conectaste)" },
  { label: "Resultado", detail: "Respuesta en chat · pago o bandeja humana" },
];
