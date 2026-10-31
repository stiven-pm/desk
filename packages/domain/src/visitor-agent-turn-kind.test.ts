import { describe, expect, it } from "vitest";
import {
  effectiveVisitorTurnKind,
  inferAgentVisitorTurnKind,
} from "./visitor-agent-turn-kind";

describe("inferAgentVisitorTurnKind", () => {
  it("prioriza pending_offer", () => {
    expect(
      inferAgentVisitorTurnKind({
        visitorIntent: "general",
        pendingPrompt: true,
        hasProductCatalog: true,
        commerceSearchUsed: true,
        commerceCartMutated: true,
        agentRescueFailure: false,
      }),
    ).toBe("pending_offer");
  });

  it("fallo de rescate → agent_struggling", () => {
    expect(
      inferAgentVisitorTurnKind({
        visitorIntent: "general",
        pendingPrompt: false,
        hasProductCatalog: false,
        commerceSearchUsed: false,
        commerceCartMutated: false,
        agentRescueFailure: true,
      }),
    ).toBe("agent_struggling");
  });

  it("catálogo en respuesta → browse_catalog", () => {
    expect(
      inferAgentVisitorTurnKind({
        visitorIntent: "general",
        pendingPrompt: false,
        hasProductCatalog: true,
        commerceSearchUsed: false,
        commerceCartMutated: false,
        agentRescueFailure: false,
      }),
    ).toBe("browse_catalog");
  });
});

describe("effectiveVisitorTurnKind", () => {
  it("escala a agent_struggling tras umbral", () => {
    expect(
      effectiveVisitorTurnKind({
        turnKind: "faq",
        struggleCount: 2,
        phase: "automated",
      }),
    ).toBe("agent_struggling");
  });
});
