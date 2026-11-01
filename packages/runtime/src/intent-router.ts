import type { VisitorTurnIntent } from "@chatbot/domain";

export type { VisitorTurnIntent };

export function classifyVisitorTurn(text: string): VisitorTurnIntent {
  if (!text.trim()) return "small_talk";
  return "general";
}

/** Herramientas commerce_* cuando hay catálogo nativo, carrito o perfil commerce activo. */
export function shouldAttachCommerceTools(opts: {
  cartLineCount: number;
  hasNativeCatalog?: boolean;
  orgHasCommerce?: boolean;
}): boolean {
  if (opts.hasNativeCatalog) return true;
  if (opts.cartLineCount > 0) return true;
  return Boolean(opts.orgHasCommerce);
}

export function shouldInjectNativeCatalogContext(opts?: {
  attachCommerce?: boolean;
}): boolean {
  return Boolean(opts?.attachCommerce);
}

export function nativeCatalogPromptCompact(_intent: VisitorTurnIntent): boolean {
  return true;
}

export type VisitorTurnHandler =
  | "native"
  | "small_talk"
  | "llm"
  | "handoff";

export function logVisitorTurn(meta: {
  orgId: string;
  conversationId: string | null;
  channel: string;
  intent: VisitorTurnIntent;
  phase: string;
  handler: VisitorTurnHandler;
}): void {
  console.error(
    JSON.stringify({
      tag: "desk_visitor_turn",
      ...meta,
      at: new Date().toISOString(),
    }),
  );
}

export function logLlmVisitorFailure(meta: {
  orgId: string;
  conversationId: string | null;
  reason: string;
  intent?: VisitorTurnIntent;
}): void {
  console.error(
    JSON.stringify({
      tag: "desk_llm_visitor_failure",
      ...meta,
      at: new Date().toISOString(),
    }),
  );
}
