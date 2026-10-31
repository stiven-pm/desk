import type { ConversationPhase } from "@chatbot/domain";
import {
  buildVisitorStateBarChoices,
  effectiveVisitorTurnKind,
  resolveVisitorActions,
  type VisitorStateBarChoice,
  type VisitorTurnKind,
} from "@chatbot/domain";
import {
  assistantResponseHasChoices,
  assistantResponseHasProductCatalog,
  consolidateDeskUiFences,
} from "./visitor-state-bar-ui";

export type ApplyVisitorAssistantHarnessInput = {
  text: string;
  phase: ConversationPhase;
  cartLineCount: number;
  hasPublishedCatalog: boolean;
  turnKind?: VisitorTurnKind;
  actionProductId?: string;
  extraChoices?: VisitorStateBarChoice[];
  harnessExtraChoices?: VisitorStateBarChoice[];
  struggleCount?: number;
};

/** Misma composición de acciones que visitorAssistantWithHarness (sin firma desk-ui). */
export function applyVisitorAssistantActionHarness(
  input: ApplyVisitorAssistantHarnessInput,
): string {
  const mergedExtra = [
    ...(input.harnessExtraChoices ?? []),
    ...(input.extraChoices ?? []),
  ];
  let turnKind = input.turnKind;
  if (turnKind != null && input.struggleCount != null) {
    turnKind = effectiveVisitorTurnKind({
      turnKind,
      struggleCount: input.struggleCount,
      phase: input.phase,
    });
  }

  const items = turnKind
    ? resolveVisitorActions({
        turnKind,
        phase: input.phase,
        cartLineCount: input.cartLineCount,
        hasPublishedCatalog: input.hasPublishedCatalog,
        productId: input.actionProductId,
        extraChoices: mergedExtra.length ? mergedExtra : undefined,
      })
    : buildVisitorStateBarChoices({
        phase: input.phase,
        cartLineCount: input.cartLineCount,
        hasPublishedCatalog: input.hasPublishedCatalog,
        responseHasChoices: assistantResponseHasChoices(input.text),
        responseHasProductCatalog: assistantResponseHasProductCatalog(input.text),
        extraChoices: mergedExtra.length ? mergedExtra : undefined,
      });

  return consolidateDeskUiFences(input.text, items);
}
