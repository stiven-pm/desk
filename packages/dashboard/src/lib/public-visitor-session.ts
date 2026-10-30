/** Carrito en tienda pública vs chat (hosted / burbuja / `/chat/…`). */

export type PublicVisitorScope = "chat" | "store";

export function publicVisitorStorageKey(
  botId: string,
  kind: "visitor" | "conv",
  scope: PublicVisitorScope = "chat",
): string {
  if (scope === "store") {
    return `desk:store:${kind}:${botId}`;
  }
  return `desk:${kind}:${botId}`;
}

/** Empieza un chat vacío en este navegador (no borra datos en el panel admin). */
export function clearPublicVisitorSession(
  botId: string,
  scope: PublicVisitorScope = "chat",
): void {
  localStorage.removeItem(publicVisitorStorageKey(botId, "conv", scope));
  localStorage.setItem(
    publicVisitorStorageKey(botId, "visitor", scope),
    crypto.randomUUID(),
  );
}

/**
 * Antes carrito y chat compartían `desk:conv` / `desk:visitor`.
 * Mueve esa sesión al scope `store` y deja el chat con visitante nuevo.
 */
export function migrateStoreChatSessionSplit(botId: string): void {
  if (typeof window === "undefined") return;
  const flag = `desk:migration:store-chat-split:${botId}`;
  if (localStorage.getItem(flag)) return;

  const legacyConv = localStorage.getItem(
    publicVisitorStorageKey(botId, "conv", "chat"),
  );
  const storeConv = localStorage.getItem(
    publicVisitorStorageKey(botId, "conv", "store"),
  );

  if (legacyConv && !storeConv) {
    const legacyVisitor = localStorage.getItem(
      publicVisitorStorageKey(botId, "visitor", "chat"),
    );
    localStorage.setItem(
      publicVisitorStorageKey(botId, "conv", "store"),
      legacyConv,
    );
    if (legacyVisitor) {
      localStorage.setItem(
        publicVisitorStorageKey(botId, "visitor", "store"),
        legacyVisitor,
      );
    }
    localStorage.removeItem(publicVisitorStorageKey(botId, "conv", "chat"));
    localStorage.setItem(
      publicVisitorStorageKey(botId, "visitor", "chat"),
      crypto.randomUUID(),
    );
  }

  localStorage.setItem(flag, "1");
}
