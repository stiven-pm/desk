/** Intención de escalar a humano tras triaje en el chat web. */

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
