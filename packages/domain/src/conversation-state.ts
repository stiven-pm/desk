export type ConversationPhase =
  | "automated"
  | "handoff_triage"
  | "needs_human"
  | "human_active"
  | "closed";

export type ClientEvent =
  | { type: "user_message"; text: string }
  | { type: "user_feedback"; rating: 1 | -1 }
  | { type: "request_human" };

export function transitionPhase(
  current: ConversationPhase,
  event: ClientEvent,
): ConversationPhase {
  if (current === "closed") return "closed";
  if (event.type === "request_human") {
    if (current === "automated") return "handoff_triage";
    if (current === "handoff_triage") return "needs_human";
    return "needs_human";
  }
  if (current === "human_active") return "human_active";
  return "automated";
}

export function canAutomateReply(phase: ConversationPhase): boolean {
  return phase === "automated" || phase === "handoff_triage";
}
