import { PLAN_LIMITS } from "@chatbot/domain";

export const platformStats = [
  { value: "24/7", label: "Oportunidades fuera de horario" },
  { value: "1", label: "Factura fija al mes" },
  {
    value: PLAN_LIMITS.business.monthlyMessages.toLocaleString("es"),
    label: "Mensajes/mes (Business)",
  },
  { value: "Chat web", label: "Tienda + chat hosted" },
];

export const platformBenefits = [
  {
    title: "Deja de pagar con tiempo del equipo",
    body: "Lo que hoy es el décimo correo igual lo atiende el chat — tu gente vende y desbloquea.",
  },
  {
    title: "Convierte consultas en confianza",
    body: "Respuestas alineadas a tu política real, con datos actuales cuando los conectas.",
  },
  {
    title: "Escala sin dramatizar contratación",
    body: "Más clientes en el mismo mes no significa automáticamente más nómina de soporte.",
  },
  {
    title: "Presupuesto predecible",
    body: "El CFO sabe el número. No hay sorpresa por minuto ni por ticket fantasma.",
  },
  {
    title: "Menos errores caros",
    body: "Menos “te dije otra cosa ayer”: la IA responde siempre con la misma política.",
  },
  {
    title: "Crece contigo",
    body: "Más mensajes y más asientos en el panel — mismo chat, plan superior.",
  },
  {
    title: "Equipo sin mezclar permisos",
    body: "Agentes responden clientes; administradores configuran web e integraciones. Registro de quién hizo qué.",
  },
];

export const platformModules = [
  {
    title: "Atención que suena a tu empresa",
    body: "El cliente siente que habla contigo, no con un FAQ pegado.",
    tags: ["Marca", "Confianza"],
  },
  {
    title: "Donde ya te compran",
    body: "Mismo chat en enlace hosted o widget en tu web — un solo hilo, un solo conocimiento.",
    tags: ["Conversión", "Chat"],
  },
  {
    title: "Conocimiento que ya tienes",
    body: "Políticas y listas de precios que hoy están en PDF dejan de estar encerradas en un cajón.",
    tags: ["Rápido de arrancar"],
  },
  {
    title: "Datos vivos del negocio",
    body: "Catálogo nativo en Desk; opcionalmente APIs a tu tienda o ERP para stock y pedidos.",
    tags: ["Integraciones"],
  },
  {
    title: "Una sola versión",
    body: "Todos tus clientes reciben la misma política, sin depender de quién conteste.",
    tags: ["Consistencia"],
  },
  {
    title: "Conectado a lo que ya usas",
    body: "ERP, tienda, CRM: sin reemplazar tu stack, sí quitándole fricción al cliente.",
    tags: ["Integraciones"],
  },
  {
    title: "Control del gasto",
    body: "Ves el consumo del plan antes de que el mes te sorprenda.",
    tags: ["Transparencia"],
  },
];

export const typicalQuestions = [
  "¿Qué productos tienen y a qué precio?",
  "¿Cuál es la garantía o la política de devolución?",
  "Quiero armar un pedido y pagar",
  "¿Cuál es el horario? Necesito hablar con alguien",
];

export type PlanColumn = "starter" | "growth" | "business";

export interface PlanFeatureRow {
  label: string;
  starter: string | boolean;
  growth: string | boolean;
  business: string | boolean;
}

export const planFeatureMatrix: PlanFeatureRow[] = [
  {
    label: "Mensajes de tus clientes / mes",
    starter: PLAN_LIMITS.starter.monthlyMessages.toLocaleString("es"),
    growth: PLAN_LIMITS.growth.monthlyMessages.toLocaleString("es"),
    business: PLAN_LIMITS.business.monthlyMessages.toLocaleString("es"),
  },
  {
    label: "Asientos de panel (login propio cada uno)",
    starter: String(PLAN_LIMITS.starter.maxSeats),
    growth: String(PLAN_LIMITS.growth.maxSeats),
    business: String(PLAN_LIMITS.business.maxSeats),
  },
  {
    label: "Chat web hosted (enlace + widget, mismo chat)",
    starter: true,
    growth: true,
    business: true,
  },
  {
    label: "Documentos para entrenar la IA",
    starter: String(PLAN_LIMITS.starter.maxRagSources),
    growth: String(PLAN_LIMITS.growth.maxRagSources),
    business: String(PLAN_LIMITS.business.maxRagSources),
  },
  {
    label: "Historial de conversaciones",
    starter: `${PLAN_LIMITS.starter.logRetentionDays} días`,
    growth: `${PLAN_LIMITS.growth.logRetentionDays} días`,
    business: `${PLAN_LIMITS.business.logRetentionDays} días`,
  },
  {
    label: "Acciones a tus sistemas",
    starter: String(PLAN_LIMITS.starter.maxHttpToolsPerBot),
    growth: String(PLAN_LIMITS.growth.maxHttpToolsPerBot),
    business: String(PLAN_LIMITS.business.maxHttpToolsPerBot),
  },
  {
    label: "Automatizaciones avanzadas",
    starter: String(PLAN_LIMITS.starter.maxMcpServersPerBot),
    growth: String(PLAN_LIMITS.growth.maxMcpServersPerBot),
    business: String(PLAN_LIMITS.business.maxMcpServersPerBot),
  },
  {
    label: "Avisos a tu software",
    starter: String(PLAN_LIMITS.starter.maxOrgWebhooks),
    growth: String(PLAN_LIMITS.growth.maxOrgWebhooks),
    business: String(PLAN_LIMITS.business.maxOrgWebhooks),
  },
];
