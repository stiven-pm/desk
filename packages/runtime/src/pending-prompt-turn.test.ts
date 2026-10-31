import { describe, expect, it } from "vitest";
import {
  createPendingPrompt,
  DESK_CMD_MENU,
  DESK_CMD_PAY,
} from "@chatbot/domain";
import {
  applyPendingVerdict,
  resolvePendingPromptFromDeskOffer,
} from "./pending-prompt-turn";

describe("resolvePendingPromptFromDeskOffer", () => {
  const meta = new Map<string, string>();

  it("accept on signed Sí runs pending menu action", () => {
    meta.set(
      "pending_prompt_json",
      JSON.stringify(
        createPendingPrompt({
          action: DESK_CMD_MENU,
          offerSummary: "ver el menú",
        }),
      ),
    );
    const r = resolvePendingPromptFromDeskOffer(
      "offer_accept",
      (k) => meta.get(k) ?? null,
      (k, v) => meta.set(k, v),
    );
    expect(r).toEqual({ type: "accept", deskCommand: DESK_CMD_MENU });
    expect(meta.get("pending_prompt_json")).toBe("");
  });

  it("decline on signed No clears pending", () => {
    meta.set(
      "pending_prompt_json",
      JSON.stringify(
        createPendingPrompt({
          action: DESK_CMD_PAY,
          offerSummary: "pagar",
        }),
      ),
    );
    const r = resolvePendingPromptFromDeskOffer(
      "offer_decline",
      (k) => meta.get(k) ?? null,
      (k, v) => meta.set(k, v),
    );
    expect(r.type).toBe("decline");
    expect(meta.get("pending_prompt_json")).toBe("");
  });

  it("missing pending when no state", () => {
    meta.delete("pending_prompt_json");
    const r = resolvePendingPromptFromDeskOffer(
      "offer_accept",
      (k) => meta.get(k) ?? null,
      (k, v) => meta.set(k, v),
    );
    expect(r).toEqual({ type: "missing_pending" });
  });
});

describe("applyPendingVerdict pay accept", () => {
  it("uses signed pay button not direct checkout", () => {
    const meta = new Map<string, string>();
    const pending = createPendingPrompt({
      action: DESK_CMD_PAY,
      offerSummary: "pagar",
    });
    const r = applyPendingVerdict(
      pending,
      "accept",
      (k, v) => meta.set(k, v),
    );
    expect(r).toMatchObject({
      type: "use_signed_action",
      deskCommand: DESK_CMD_PAY,
    });
  });
});
