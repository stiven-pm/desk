/** Saludo sin LLM. */

export function buildVisitorSmallTalkReply(opts: {
  orgName?: string | null;
}): string {
  const brand = opts.orgName?.trim();
  if (brand) {
    return `¡Hola! Gracias por escribir a ${brand}. ¿En qué te podemos ayudar?`;
  }
  return "¡Hola! ¿En qué te podemos ayudar hoy?";
}
