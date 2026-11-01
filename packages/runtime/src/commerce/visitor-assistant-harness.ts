import type { CheckoutFlow, ConversationPhase } from "@chatbot/domain";
import {
  effectiveVisitorTurnKind,
  resolveVisitorActions,
  type VisitorStateBarChoice,
  type VisitorTurnKind,
} from "@chatbot/domain";
import {
  consolidateDeskUiFences,
  stripModelDeskBlocksWhenCheckoutBusy,
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
  checkoutFlow?: CheckoutFlow;
};

/** Misma composición de acciones que visitorAssistantWithHarness (sin firma desk-ui). */
export function applyVisitorAssistantActionHarness(
  input: ApplyVisitorAssistantHarnessInput,
): string {
  const mergedExtra = [
    ...(input.harnessExtraChoices ?? []),
    ...(input.extraChoices ?? []),
  ];
  let turnKind = input.turnKind ?? "faq";
  if (input.turnKind != null && input.struggleCount != null) {
    turnKind = effectiveVisitorTurnKind({
      turnKind: input.turnKind,
      struggleCount: input.struggleCount,
      phase: input.phase,
    });
  }

  const checkoutFlow = input.checkoutFlow;
  let body = stripModelDeskBlocksWhenCheckoutBusy(
    input.text,
    checkoutFlow != null && checkoutFlow.phase !== "idle",
  );

  const items = resolveVisitorActions({
    turnKind,
    phase: input.phase,
    cartLineCount: input.cartLineCount,
    hasPublishedCatalog: input.hasPublishedCatalog,
    productId: input.actionProductId,
    extraChoices: mergedExtra.length ? mergedExtra : undefined,
    checkoutFlow,
  });

  return consolidateDeskUiFences(body, items);
}
