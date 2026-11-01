import { DESK_AGENT_TOOL } from "@chatbot/domain";
import { parseToolCallsFromContent } from "../llm-client";

const GLM_XML_TOOL_CALL =
  /<tool_call>\s*([a-z_][a-z0-9_]*)[\s\S]*?<arg_key>\s*text\s*<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>\s*<\/tool_call>/gi;

/** GLM sometimes emits XML tool syntax or prose tool calls instead of native tool_calls. */
export function extractVisitorFacingText(
  raw: string,
  allowedToolNames?: Set<string>,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  for (const match of trimmed.matchAll(GLM_XML_TOOL_CALL)) {
    const name = match[1];
    const value = match[2]?.trim() ?? "";
    if (!value) continue;
    if (!allowedToolNames?.size || allowedToolNames.has(name)) {
      return value;
    }
    if (name === DESK_AGENT_TOOL.visitorMessage) return value;
  }

  const allow =
    allowedToolNames ??
    new Set<string>([DESK_AGENT_TOOL.visitorMessage]);
  const parsed = parseToolCallsFromContent(trimmed, allow);
  const visitorCall = parsed?.find(
    (c) => c.name === DESK_AGENT_TOOL.visitorMessage,
  );
  if (visitorCall) {
    try {
      const args = JSON.parse(visitorCall.arguments) as { text?: string };
      const text = String(args.text ?? "").trim();
      if (text) return text;
    } catch {
      /* fall through */
    }
  }

  if (/^<tool_call>/i.test(trimmed)) {
    return trimmed
      .replace(/<\/?tool_call[^>]*>/gi, " ")
      .replace(/<arg_key>[\s\S]*?<\/arg_key>/gi, " ")
      .replace(/<arg_value>([\s\S]*?)<\/arg_value>/gi, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  return trimmed;
}
