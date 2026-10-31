import { describe, expect, it } from "vitest";
import { isHandoffGiveUpIntent } from "./human-handoff-intent";

describe("isHandoffGiveUpIntent", () => {
  it("detects insistence during triage", () => {
    expect(isHandoffGiveUpIntent("sí quiero un asesor")).toBe(true);
    expect(isHandoffGiveUpIntent("no sirve esto")).toBe(true);
  });

  it("ignores neutral catalog questions", () => {
    expect(isHandoffGiveUpIntent("qué productos tienen?")).toBe(false);
  });
});
