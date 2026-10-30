import { describe, expect, it } from "vitest";
import { isHumanHandoffIntent } from "./human-handoff-intent";

describe("isHumanHandoffIntent", () => {
  it("detects sales handoff phrases", () => {
    expect(isHumanHandoffIntent("Quiero hablar con ventas")).toBe(true);
    expect(isHumanHandoffIntent("Quiero dejar mi contacto")).toBe(true);
  });

  it("ignores generic chat", () => {
    expect(isHumanHandoffIntent("qué productos tienen?")).toBe(false);
  });
});
