import { parseAssistantUi } from "@chatbot/chat-ui";
import type { VisitorTurnKind } from "@chatbot/domain";
import { DESK_CMD_HUMAN, VISITOR_TURN_KINDS_WITHOUT_ACTIONS } from "@chatbot/domain";

export type VisitorAssistantUiInvariantViolation = {
  code: string;
  detail?: string;
};

export function checkVisitorAssistantUiInvariants(
  assistantText: string,
  turnKind?: VisitorTurnKind,
): VisitorAssistantUiInvariantViolation[] {
  const violations: VisitorAssistantUiInvariantViolation[] = [];
  const { blocks } = parseAssistantUi(assistantText);
  const choiceBlocks = blocks.filter((b) => b.type === "choices");

  if (choiceBlocks.length > 1) {
    violations.push({
      code: "multiple_choices_blocks",
      detail: `expected 1, got ${choiceBlocks.length}`,
    });
  }

  const choiceBlock = choiceBlocks[0];
  if (choiceBlock?.type === "choices") {
    const seen = new Set<string>();
    for (const item of choiceBlock.items) {
      const key = item.message.trim();
      if (seen.has(key)) {
        violations.push({ code: "duplicate_choice_message", detail: key });
      }
      seen.add(key);
    }
    if (choiceBlock.items.length > 4) {
      violations.push({
        code: "too_many_buttons",
        detail: String(choiceBlock.items.length),
      });
    }
    if (turnKind && VISITOR_TURN_KINDS_WITHOUT_ACTIONS.has(turnKind)) {
      if (choiceBlock.items.length > 0) {
        violations.push({
          code: "unexpected_actions_for_turn_kind",
          detail: turnKind,
        });
      }
    }
    const humanInBody = choiceBlock.items.some(
      (i) => i.message.trim() === DESK_CMD_HUMAN,
    );
    if (
      humanInBody &&
      turnKind &&
      turnKind !== "agent_struggling" &&
      turnKind !== "handoff"
    ) {
      violations.push({ code: "human_not_allowed", detail: turnKind });
    }
  }

  return violations;
}
