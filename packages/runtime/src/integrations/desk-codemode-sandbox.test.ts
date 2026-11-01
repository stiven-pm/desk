import { describe, expect, it } from "vitest";
import { deskCodemodeWorkerId } from "./desk-codemode-sandbox";

describe("desk-codemode-sandbox", () => {
  it("uses stable worker id per bot", () => {
    expect(deskCodemodeWorkerId("bot-1")).toBe("desk-cm-bot-1-v1");
    expect(deskCodemodeWorkerId("bot-1")).toBe(deskCodemodeWorkerId("bot-1"));
  });
});
