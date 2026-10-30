/** Etiqueta para operadores (bandeja). */
export function formatVisitorContactLabel(
  visitorId: string | null,
  visitorPhone: string | null,
  conversationId: string,
): string {
  if (visitorPhone?.trim()) return visitorPhone.trim();
  if (visitorId?.trim()) {
    const id = visitorId.trim();
    if (id.length <= 12) return id;
    return `Visitante ${id.slice(0, 8)}`;
  }
  return `Chat ${conversationId.slice(0, 8)}`;
}
