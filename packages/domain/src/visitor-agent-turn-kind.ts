import type { ConversationPhase } from "./conversation-state";
import type { VisitorTurnKind } from "./visitor-actions-policy";

/** Intención previa al LLM (ver runtime intent-router). */
export type VisitorTurnIntent = "small_talk" | "general";

/** Umbral estructural antes de forzar botones de rescate (humano en cuerpo). */
export const VISITOR_STRUGGLE_COUNT_THRESHOLD = 2;

export const META_VISITOR_STRUGGLE_COUNT = "visitor_struggle_count";

export type InferAgentVisitorTurnKindInput = {
  visitorIntent: VisitorTurnIntent;
  pendingPrompt: boolean;
  hasProductCatalog: boolean;
  commerceSearchUsed: boolean;
  commerceCartMutated: boolean;
  agentRescueFailure: boolean;
};

export function inferAgentVisitorTurnKind(
  input: InferAgentVisitorTurnKindInput,
): VisitorTurnKind {
  if (input.agentRescueFailure) return "agent_struggling";
  if (input.pendingPrompt) return "pending_offer";
  if (input.hasProductCatalog || input.commerceSearchUsed) {
    return "browse_catalog";
  }
  if (input.commerceCartMutated) return "cart_updated";
  if (input.visitorIntent === "small_talk") return "greeting";
  return "faq";
}

export function effectiveVisitorTurnKind(args: {
  turnKind: VisitorTurnKind;
  struggleCount: number;
  phase: ConversationPhase;
}): VisitorTurnKind {
  if (args.phase === "handoff_triage") return "handoff";
  if (
    args.struggleCount >= VISITOR_STRUGGLE_COUNT_THRESHOLD &&
    args.turnKind !== "pending_offer" &&
    args.turnKind !== "handoff" &&
    args.turnKind !== "checkout"
  ) {
    return "agent_struggling";
  }
  return args.turnKind;
}

export function parseStruggleCount(raw: string | null): number {
  if (!raw?.trim()) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
