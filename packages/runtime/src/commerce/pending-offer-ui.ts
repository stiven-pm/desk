import {
  DESK_CMD_OFFER_ACCEPT,
  DESK_CMD_OFFER_DECLINE,
} from "@chatbot/domain";
import { appendVisitorStateBarDeskUi } from "./visitor-state-bar-ui";

const OFFER_CHOICES = [
  { label: "Sí", message: DESK_CMD_OFFER_ACCEPT },
  { label: "No", message: DESK_CMD_OFFER_DECLINE },
] as const;

/** Botones firmados Sí/No tras `commerce_offer_action` (pending sigue activo para texto libre). */
export function appendPendingOfferChoicesDeskUi(text: string): string {
  return appendVisitorStateBarDeskUi(text, [...OFFER_CHOICES]);
}
