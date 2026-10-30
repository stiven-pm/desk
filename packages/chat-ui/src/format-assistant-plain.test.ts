import { describe, expect, it } from "vitest";
import { formatAssistantTextPlain } from "./format-assistant-plain";

describe("formatAssistantTextPlain", () => {
  it("keeps prose and strips desk-ui fence", () => {
    const raw = `Hola\n\`\`\`desk-ui\n{"blocks":[]}\n\`\`\``;
    const out = formatAssistantTextPlain(raw);
    expect(out).toContain("Hola");
    expect(out).not.toContain("desk-ui");
  });

  it("formats product blocks", () => {
    const raw =
      'Ver catálogo\n```desk-ui\n{"blocks":[{"type":"products","items":[{"title":"Gorra","price":"$10"}]}]}\n```';
    const out = formatAssistantTextPlain(raw);
    expect(out).toContain("Gorra");
    expect(out).toContain("$10");
  });
});
