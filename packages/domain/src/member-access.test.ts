import { describe, expect, it } from "vitest";
import {
  canAccessLegacyRoles,
  resolveMemberCapabilities,
  serializeCapabilities,
} from "./member-access";

describe("member capabilities", () => {
  it("combines custom caps for member role", () => {
    const json = serializeCapabilities(["knowledge", "inbox"]);
    const caps = resolveMemberCapabilities("member", json);
    expect(caps).toEqual(["inbox", "knowledge"]);
    expect(
      canAccessLegacyRoles("member", json, ["owner", "admin", "developer"]),
    ).toBe(true);
    expect(canAccessLegacyRoles("member", json, ["owner", "admin"])).toBe(
      false,
    );
  });

  it("agent preset reaches inbox routes", () => {
    expect(canAccessLegacyRoles("agent", null, ["owner", "admin", "agent"])).toBe(
      true,
    );
  });
});
