import { describe, expect, it } from "vitest";
import {
  createPendingPrompt,
  isPendingPromptExpired,
  parsePendingPrompt,
  pendingOfferActionToDeskCommand,
  serializePendingPrompt,
} from "./pending-prompt";
import { DESK_CMD_MENU } from "./desk-action-commands";

describe("pending-prompt", () => {
  it("maps offer actions to desk commands", () => {
    expect(pendingOfferActionToDeskCommand("menu")).toBe(DESK_CMD_MENU);
  });

  it("round-trips meta json", () => {
    const p = createPendingPrompt({
      action: DESK_CMD_MENU,
      offerSummary: "ver el menú",
      now: new Date("2026-01-01T12:00:00Z"),
    });
    const raw = serializePendingPrompt(p);
    const parsed = parsePendingPrompt(raw);
    expect(parsed?.action).toBe(DESK_CMD_MENU);
    expect(parsed?.offerSummary).toBe("ver el menú");
  });

  it("expires after ttl", () => {
    const p = createPendingPrompt({
      action: DESK_CMD_MENU,
      offerSummary: "x",
      now: new Date("2026-01-01T12:00:00Z"),
    });
    expect(
      isPendingPromptExpired(p, new Date("2026-01-01T12:09:00Z")),
    ).toBe(false);
    expect(
      isPendingPromptExpired(p, new Date("2026-01-01T12:11:00Z")),
    ).toBe(true);
  });
});
