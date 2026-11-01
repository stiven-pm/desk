import { DESK_AGENT_TOOL } from "@chatbot/domain";
import type { LlmToolSchema } from "./types";

export function deskEscalateHumanLlmTool(): LlmToolSchema {
  return {
    type: "function",
    function: {
      name: DESK_AGENT_TOOL.escalateHuman,
      description:
        "Transfer this chat to the human queue after you have triaged (e.g. commerce_get_order when relevant). " +
        "Use when the visitor needs refund, resend, or manual fulfillment you cannot run with tools — not on the first 'order missing' message before lookup. " +
        "Call instead of desk_visitor_message when handing off; runtime escalates immediately.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "Short message to the visitor confirming a human will continue here.",
          },
        },
        required: ["text"],
      },
    },
  };
}

export function isDeskEscalateHumanTool(name: string): boolean {
  return name === DESK_AGENT_TOOL.escalateHuman;
}

export function parseDeskEscalateHumanArgs(
  args: Record<string, unknown>,
): string {
  return String(args.text ?? "").trim();
}
