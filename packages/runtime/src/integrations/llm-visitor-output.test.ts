import { describe, expect, it } from "vitest";
import { extractVisitorFacingText } from "./llm-visitor-output";

describe("extractVisitorFacingText", () => {
  it("unwraps GLM XML desk_visitor_message", () => {
    const raw =
      "<tool_call>desk_visitor_message<arg_key>text</arg_key><arg_value>¡Hola, Stiven!</arg_value></tool_call>";
    expect(extractVisitorFacingText(raw)).toBe("¡Hola, Stiven!");
  });

  it("unwraps inline desk_visitor_message JSON call", () => {
    expect(
      extractVisitorFacingText('desk_visitor_message({"text":"ok"})'),
    ).toBe("ok");
  });
});
