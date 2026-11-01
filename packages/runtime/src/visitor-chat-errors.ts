/** Textos para visitantes del chat — sin nombres de proveedores ni detalles de ops. */

export const VISITOR_CHAT_UNAVAILABLE =
  "El asistente no está disponible en este momento. Prueba de nuevo en unos minutos.";

/** Texto legado — conversaciones guardadas antes del cambio de copy. */
export const VISITOR_CHAT_UNAVAILABLE_LEGACY =
  "En este momento no puedo ayudarte con eso. Prueba de nuevo en unos minutos.";

export const VISITOR_CHAT_TIMEOUT =
  "Estoy tardando más de lo normal. ¿Puedes intentar con un mensaje un poco más corto?";

export const VISITOR_CHAT_TOOLS_FAILED =
  "No pude completar la consulta con la información del negocio. ¿Quieres que te pase con alguien del equipo?";

/** Fallo del LLM en commerce: sin inventar catálogo; el runtime adjunta botones de estado. */
export const VISITOR_CHAT_RESCUE_HONEST =
  "Tuve un problema técnico en este momento. ¿Qué prefieres hacer?";

/** Escalera LLM paso 3: sin tools; no repetir copy del modelo que mencione botones genéricos. */
export const VISITOR_CHAT_DEGRADED_NO_TOOLS =
  "No pude completar la consulta en el sistema en este momento. Si quieres, te comunico con el equipo para revisarlo contigo.";

/** Solo cuando el modelo no respondió tras reintentos (fallo real de servicio). */
export function visitorMessageForLlmFailure(
  reason: "not_configured" | "http_error" | "timeout" | "empty_response",
  opts?: { commerceToolsActive?: boolean },
): string {
  if (reason === "timeout") return VISITOR_CHAT_TIMEOUT;
  if (opts?.commerceToolsActive) return VISITOR_CHAT_RESCUE_HONEST;
  return VISITOR_CHAT_UNAVAILABLE;
}

export function isVisitorLlmFailureMessage(text: string): boolean {
  const t = text.trim();
  return (
    t === VISITOR_CHAT_UNAVAILABLE ||
    t === VISITOR_CHAT_UNAVAILABLE_LEGACY ||
    t === VISITOR_CHAT_TIMEOUT
  );
}
