import { describe, expect, it, vi } from "vitest";
import {
  deskTrace,
  deskTraceClip,
  deskTraceEnabled,
  deskTraceLlmVerbose,
} from "./desk-trace";

describe("deskTrace", () => {
  it("enabled only with DESK_TRACE=1", () => {
    expect(deskTraceEnabled({})).toBe(false);
    expect(deskTraceEnabled({ DESK_TRACE: "1" })).toBe(true);
    expect(deskTraceLlmVerbose({ DESK_LLM_DEBUG: "1" })).toBe(true);
  });

  it("clips long strings", () => {
    expect(deskTraceClip("abc")).toBe("abc");
    expect(deskTraceClip("x".repeat(900))).toContain("[+100]");
  });

  it("no-ops when disabled", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    deskTrace({}, "test", { x: 1 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
