import { describe, expect, it } from "vitest";
import { canAutomateReply, transitionPhase } from "./conversation-state";

describe("conversation state", () => {
  it("enters triage before human on first request_human", () => {
    expect(
      transitionPhase("automated", { type: "request_human" }),
    ).toBe("handoff_triage");
    expect(
      transitionPhase("handoff_triage", { type: "request_human" }),
    ).toBe("needs_human");
  });

  it("still automates during handoff triage", () => {
    expect(canAutomateReply("handoff_triage")).toBe(true);
  });

  it("blocks automation when human active", () => {
    expect(canAutomateReply("human_active")).toBe(false);
  });
});
