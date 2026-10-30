/** Intención de escalar a humano en el chat web. */

export function isHumanHandoffIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/\b(asesor|humano|persona|agente|equipo|operador|ventas|vendedor)\b/.test(t)) {
    return true;
  }
  if (/\b(hablar con|quiero hablar|necesito hablar|pasar con)\b/.test(t)) {
    return true;
  }
  if (/\b(dejar|dejame|déjame)\s+(mi\s+)?contacto\b/.test(t)) return true;
  if (/\bcontacto\b/.test(t) && /\b(dejar|enviar|compartir)\b/.test(t)) return true;
  return false;
}

/** Tras triaje: el visitante insiste en humano. */
export function isHandoffGiveUpIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/\b(no me ayud|no sirve|no entiend|frustrad)\b/.test(t)) return true;
  if (/\b(asesor|humano|persona|equipo)\b/.test(t) && t.length < 120) {
    return true;
  }
  if (/\b(si|sí)\b/.test(t) && /\b(asesor|humano)\b/.test(t) && t.length < 100) {
    return true;
  }
  return false;
}
