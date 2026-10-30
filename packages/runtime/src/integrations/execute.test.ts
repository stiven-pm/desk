import { describe, expect, it } from "vitest";
import { executeHttpTool } from "./execute";
import type { BotHttpTool } from "./types";

describe("executeHttpTool SSRF", () => {
  it("blocks private hosts", async () => {
    const tool: BotHttpTool = {
      id: "t1",
      name: "test",
      description: "",
      method: "GET",
      path: "/",
      baseUrl: "http://127.0.0.1:8080",
      parameters: [],
      authType: "none",
    };
    const out = await executeHttpTool(tool, {});
    expect(out).toContain("url_host_blocked");
  });
});
