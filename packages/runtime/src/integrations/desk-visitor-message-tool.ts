import { DESK_AGENT_TOOL } from "@chatbot/domain";
import type { LlmToolSchema } from "./types";

export function deskVisitorMessageLlmTool(): LlmToolSchema {
  return {
    type: "function",
    function: {
      name: DESK_AGENT_TOOL.visitorMessage,
      description:
        "Send the visitor-facing reply for this turn. Use after data tools return, or alone when no lookup is needed. " +
        "Do not set offerHuman or ask the visitor to press Talk to a person — use desk_escalate_to_human for handoff.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Message shown to the visitor in their language.",
          },
        },
        required: ["text"],
      },
    },
  };
}

export function isDeskVisitorMessageTool(name: string): boolean {
  return name === DESK_AGENT_TOOL.visitorMessage;
}

export function parseDeskVisitorMessageArgs(
  args: Record<string, unknown>,
): string {
  return String(args.text ?? "").trim();
}
