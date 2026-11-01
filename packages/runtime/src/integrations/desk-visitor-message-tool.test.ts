import { describe, expect, it } from "vitest";
import { DESK_AGENT_TOOL } from "@chatbot/domain";
import {
  isDeskVisitorMessageTool,
  parseDeskVisitorMessageArgs,
} from "./desk-visitor-message-tool";

describe("desk_visitor_message tool", () => {
  it("matches constant name", () => {
    expect(isDeskVisitorMessageTool(DESK_AGENT_TOOL.visitorMessage)).toBe(true);
    expect(isDeskVisitorMessageTool("commerce_get_order")).toBe(false);
  });

  it("parses text arg", () => {
    expect(parseDeskVisitorMessageArgs({ text: "  Hola  " })).toBe("Hola");
  });
});
