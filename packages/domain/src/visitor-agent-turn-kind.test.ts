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

  it("consent step gana sobre rescate degradado", () => {
    expect(
      inferAgentVisitorTurnKind({
        visitorIntent: "general",
        pendingPrompt: false,
        hasProductCatalog: false,
        commerceSearchUsed: false,
        commerceCartMutated: false,
        commerceConsentStep: true,
        agentRescueFailure: true,
      }),
    ).toBe("buyer_consent");
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

  it("integración usada no fuerza turnKind service", () => {
    expect(
      inferAgentVisitorTurnKind({
        visitorIntent: "general",
        pendingPrompt: false,
        hasProductCatalog: false,
        commerceSearchUsed: false,
        commerceCartMutated: false,
        agentRescueFailure: false,
        integrationToolsUsed: true,
      }),
    ).toBe("faq");
  });
});

describe("effectiveVisitorTurnKind", () => {
  it("needs_human no añade botones de handoff", () => {
    expect(
      effectiveVisitorTurnKind({
        turnKind: "handoff",
        struggleCount: 5,
        phase: "needs_human",
      }),
    ).toBe("faq");
  });
});
