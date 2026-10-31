import type { ConversationPhase } from "./conversation-state";
import {
  DESK_CMD_CART,
  DESK_CMD_CONSENT,
  DESK_CMD_HUMAN,
  DESK_CMD_MENU,
  DESK_CMD_OFFER_ACCEPT,
  DESK_CMD_OFFER_DECLINE,
  DESK_CMD_PAY,
  deskCmdAdd,
} from "./desk-action-commands";
import { deskCommandDisplayLabel } from "./desk-action";
import type { VisitorStateBarChoice } from "./visitor-state-bar";

/** Clasificación estructural del turno assistant (productor nativo o agente). */
export type VisitorTurnKind =
  | "greeting"
  | "faq"
  | "browse_catalog"
  | "product_detail"
  | "pick_qty"
  | "line_notes"
  | "buyer_field"
  | "buyer_consent"
  | "cart_view"
  | "cart_updated"
  | "pending_offer"
  | "checkout"
  | "agent_struggling"
  | "handoff";

export const MAX_VISITOR_ACTION_BUTTONS = 4;

export type ResolveVisitorActionsInput = {
  turnKind: VisitorTurnKind;
  phase: ConversationPhase;
  cartLineCount: number;
  hasPublishedCatalog: boolean;
  /** Botones extra puntuales (p. ej. Pagar firmado tras pending). */
  extraChoices?: VisitorStateBarChoice[];
  /** productId para product_detail */
  productId?: string;
};

const PRIORITY_ORDER: string[] = [
  DESK_CMD_PAY,
  DESK_CMD_CART,
  DESK_CMD_MENU,
  DESK_CMD_CONSENT,
  DESK_CMD_OFFER_ACCEPT,
  DESK_CMD_OFFER_DECLINE,
  DESK_CMD_HUMAN,
];

function pushChoice(
  items: VisitorStateBarChoice[],
  seen: Set<string>,
  label: string,
  message: string,
) {
  const key = message.trim();
  if (seen.has(key)) return;
  seen.add(key);
  items.push({ label, message: key });
}

function capActions(items: VisitorStateBarChoice[]): VisitorStateBarChoice[] {
  if (items.length <= MAX_VISITOR_ACTION_BUTTONS) return items;
  const rank = (msg: string) => {
    const i = PRIORITY_ORDER.indexOf(msg.trim());
    return i === -1 ? PRIORITY_ORDER.length : i;
  };
  return [...items].sort((a, b) => rank(a.message) - rank(b.message)).slice(0, MAX_VISITOR_ACTION_BUTTONS);
}

/**
 * Única política de botones de visitante (decisión ADR visitor-actions-policy).
 * No incluye acciones embebidas en bloques de datos (`product_catalog`, `html`).
 */
export function resolveVisitorActions(
  input: ResolveVisitorActionsInput,
): VisitorStateBarChoice[] {
  const items: VisitorStateBarChoice[] = [];
  const seen = new Set<string>();

  for (const extra of input.extraChoices ?? []) {
    pushChoice(items, seen, extra.label, extra.message);
  }

  const { turnKind, cartLineCount, hasPublishedCatalog } = input;

  switch (turnKind) {
    case "greeting":
    case "faq":
      if (hasPublishedCatalog) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "menu" }),
          DESK_CMD_MENU,
        );
      }
      if (cartLineCount > 0) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "cart" }),
          DESK_CMD_CART,
        );
      }
      break;
    case "browse_catalog":
      break;
    case "product_detail":
      if (input.productId) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "add", productId: input.productId }),
          deskCmdAdd(input.productId),
        );
      }
      pushChoice(
        items,
        seen,
        deskCommandDisplayLabel({ kind: "menu" }),
        DESK_CMD_MENU,
      );
      break;
    case "pick_qty":
    case "line_notes":
    case "buyer_field":
      break;
    case "buyer_consent":
      pushChoice(
        items,
        seen,
        deskCommandDisplayLabel({ kind: "consent" }),
        DESK_CMD_CONSENT,
      );
      break;
    case "cart_view":
      if (cartLineCount > 0) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "pay" }),
          DESK_CMD_PAY,
        );
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "menu" }),
          DESK_CMD_MENU,
        );
      } else if (hasPublishedCatalog) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "menu" }),
          DESK_CMD_MENU,
        );
      }
      break;
    case "cart_updated":
      if (cartLineCount > 0) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "pay" }),
          DESK_CMD_PAY,
        );
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "cart" }),
          DESK_CMD_CART,
        );
      }
      if (hasPublishedCatalog) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "menu" }),
          DESK_CMD_MENU,
        );
      }
      break;
    case "pending_offer":
      pushChoice(items, seen, "Sí", DESK_CMD_OFFER_ACCEPT);
      pushChoice(items, seen, "No", DESK_CMD_OFFER_DECLINE);
      break;
    case "checkout":
      break;
    case "agent_struggling":
      if (hasPublishedCatalog) {
        pushChoice(
          items,
          seen,
          deskCommandDisplayLabel({ kind: "menu" }),
          DESK_CMD_MENU,
        );
      }
      pushChoice(
        items,
        seen,
        deskCommandDisplayLabel({ kind: "human" }),
        DESK_CMD_HUMAN,
      );
      break;
    case "handoff":
      pushChoice(
        items,
        seen,
        deskCommandDisplayLabel({ kind: "human" }),
        DESK_CMD_HUMAN,
      );
      break;
  }

  return capActions(items);
}

/** turnKinds que no deben llevar botones de acción en el harness. */
export const VISITOR_TURN_KINDS_WITHOUT_ACTIONS: ReadonlySet<VisitorTurnKind> =
  new Set(["pick_qty", "line_notes", "buyer_field", "browse_catalog", "checkout"]);
