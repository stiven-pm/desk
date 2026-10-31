import type { ConversationPhase } from "./conversation-state";
import {
  DESK_CMD_CART,
  DESK_CMD_HUMAN,
  DESK_CMD_MENU,
  DESK_CMD_PAY,
} from "./desk-action-commands";
import { deskCommandDisplayLabel } from "./desk-action";

export type VisitorStateBarChoice = {
  label: string;
  message: string;
};

export type VisitorStateBarInput = {
  phase: ConversationPhase;
  cartLineCount: number;
  hasPublishedCatalog: boolean;
  responseHasChoices: boolean;
  responseHasProductCatalog: boolean;
  /** Botones extra (p. ej. un solo Pagar tras pending de pago). */
  extraChoices?: VisitorStateBarChoice[];
};

function canShowHumanShortcut(phase: ConversationPhase): boolean {
  return (
    phase === "automated" ||
    phase === "handoff_triage" ||
    phase === "needs_human"
  );
}

/**
 * Barra de acciones que el runtime adjunta según estado (no depende del LLM).
 * Los `message` son comandos `__desk:*` firmados al enviar.
 */
export function buildVisitorStateBarChoices(
  input: VisitorStateBarInput,
): VisitorStateBarChoice[] {
  const items: VisitorStateBarChoice[] = [];
  const seen = new Set<string>();

  const push = (label: string, message: string) => {
    const key = message.trim();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ label, message: key });
  };

  for (const extra of input.extraChoices ?? []) {
    push(extra.label, extra.message);
  }

  if (input.hasPublishedCatalog && !input.responseHasProductCatalog) {
    push(
      deskCommandDisplayLabel({ kind: "menu" }),
      DESK_CMD_MENU,
    );
  }

  if (input.cartLineCount > 0) {
    push(deskCommandDisplayLabel({ kind: "cart" }), DESK_CMD_CART);
    push(deskCommandDisplayLabel({ kind: "pay" }), DESK_CMD_PAY);
  }

  if (canShowHumanShortcut(input.phase)) {
    push(
      deskCommandDisplayLabel({ kind: "human" }),
      DESK_CMD_HUMAN,
    );
  }

  return items;
}
