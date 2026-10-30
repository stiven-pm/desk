import { describe, expect, it } from "vitest";
import { formatVisitorSessionForPrompt } from "./visitor-session";

describe("formatVisitorSessionForPrompt", () => {
  it("includes local time and anti-meta hint", () => {
    const block = formatVisitorSessionForPrompt({
      localIso: "lunes, 20 de octubre de 2026, 22:00",
      timezone: "America/Bogota",
      city: "Bogotá",
      country: "Colombia",
    });
    expect(block).toContain("Fecha y hora local");
    expect(block).toContain("internet");
  });
});
