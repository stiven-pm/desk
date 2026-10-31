import {
  DESK_CMD_CART,
  DESK_CMD_MENU,
  DESK_CMD_PAY,
} from "./desk-action-commands";

export const PENDING_PROMPT_META_KEY = "pending_prompt_json";

/** Minutos que el visitante puede responder a una oferta estructurada. */
export const PENDING_PROMPT_TTL_MINUTES = 10;

export type PendingPromptOfferAction = "menu" | "cart" | "pay";

export type PendingPrompt = {
  kind: "offer";
  /** Comando desk interno a ejecutar si el visitante acepta (`__desk:menu__`, …). */
  action: string;
  /** Resumen para el clasificador (ej. "ver el menú de productos"). */
  offerSummary: string;
  expiresAt: string;
  turnId?: string;
};

export type PendingPromptVerdict = "accept" | "decline" | "other";

export function pendingOfferActionToDeskCommand(
  action: PendingPromptOfferAction,
): string | null {
  switch (action) {
    case "menu":
      return DESK_CMD_MENU;
    case "cart":
      return DESK_CMD_CART;
    case "pay":
      return DESK_CMD_PAY;
    default:
      return null;
  }
}

export function defaultOfferSummary(action: PendingPromptOfferAction): string {
  switch (action) {
    case "menu":
      return "ver el menú de productos publicados";
    case "cart":
      return "ver el carrito";
    case "pay":
      return "continuar al pago";
  }
}

export function createPendingPrompt(opts: {
  action: string;
  offerSummary: string;
  turnId?: string;
  now?: Date;
}): PendingPrompt {
  const now = opts.now ?? new Date();
  const expires = new Date(
    now.getTime() + PENDING_PROMPT_TTL_MINUTES * 60_000,
  );
  return {
    kind: "offer",
    action: opts.action,
    offerSummary: opts.offerSummary.slice(0, 240),
    expiresAt: expires.toISOString(),
    turnId: opts.turnId,
  };
}

export function parsePendingPrompt(raw: string | null | undefined): PendingPrompt | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as PendingPrompt;
    if (data.kind !== "offer" || !data.action?.trim() || !data.expiresAt) {
      return null;
    }
    if (!data.offerSummary?.trim()) return null;
    return data;
  } catch {
    return null;
  }
}

export function serializePendingPrompt(p: PendingPrompt): string {
  return JSON.stringify(p);
}

export function isPendingPromptExpired(
  p: PendingPrompt,
  now: Date = new Date(),
): boolean {
  const exp = Date.parse(p.expiresAt);
  if (!Number.isFinite(exp)) return true;
  return now.getTime() >= exp;
}

/** Aceptación por texto libre solo para acciones de lectura (menú / carrito). */
export function isReadOnlyPendingDeskAction(action: string): boolean {
  const a = action.trim();
  return a === DESK_CMD_MENU || a === DESK_CMD_CART;
}

export function isEffectPendingDeskAction(action: string): boolean {
  const a = action.trim();
  return a === DESK_CMD_PAY;
}

export function buildCommerceOfferActionPromptSection(): string {
  return `
## Ofertas sí / no (estado \`pending_prompt\`)

Antes de preguntar si el visitante quiere ver el menú, el carrito o pagar, invoca **\`commerce_offer_action\`** con \`action\`: \`menu\` | \`cart\` | \`pay\` y un \`offerSummary\` breve en español.
El runtime registra la oferta y el visitante puede responder en texto libre o con botones firmados.
No hagas preguntas de sí/no sobre esas acciones sin llamar primero a \`commerce_offer_action\`.
`.trim();
}
