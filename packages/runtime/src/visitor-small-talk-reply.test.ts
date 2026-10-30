import { describe, expect, it } from "vitest";
import { buildVisitorSmallTalkReply } from "./visitor-small-talk-reply";

describe("buildVisitorSmallTalkReply", () => {
  it("includes org name when set", () => {
    expect(
      buildVisitorSmallTalkReply({
        orgName: "Acme",
      }),
    ).toMatch(/Acme/);
  });
});
