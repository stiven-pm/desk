import { describe, expect, it } from "vitest";
import {
  bucketConversationsByLocalDay,
  formatOrgDateTime,
  localDayKeyFromUtcStorage,
  parseD1UtcTimestamp,
  utcD1RangeForOrgLocalDay,
} from "./org-timezone";

describe("org-timezone", () => {
  it("D1 datetime sin Z se interpreta como UTC", () => {
    const d = parseD1UtcTimestamp("2026-10-31 01:30:00");
    expect(d.toISOString()).toBe("2026-10-31T01:30:00.000Z");
  });

  it("madrugada UTC cae en el día anterior en Bogotá", () => {
    expect(
      localDayKeyFromUtcStorage("2026-10-31 01:30:00", "America/Bogota"),
    ).toBe("2026-10-30");
  });

  it("agrupa por día local y omite días futuros al corte", () => {
    const rows = [
      { created_at: "2026-10-31 01:00:00" },
      { created_at: "2026-10-31 03:00:00" },
      { created_at: "2026-10-30 12:00:00" },
    ];
    const out = bucketConversationsByLocalDay(rows, "America/Bogota", {
      throughLocalDay: "2026-10-30",
      maxDays: 14,
    });
    expect(out).toEqual([
      { day: "2026-10-30", conversations: 3 },
    ]);
  });

  it("formatOrgDateTime muestra hora local de la org", () => {
    const out = formatOrgDateTime("2026-11-01 20:53:05", "America/Bogota");
    expect(out).toContain("3:53:05");
    expect(out.toLowerCase()).toMatch(/p\.\s*m\./);
    expect(out.startsWith("1/11/")).toBe(true);
  });

  it("utcD1RangeForOrgLocalDay acota el día en Bogotá", () => {
    const { from, to } = utcD1RangeForOrgLocalDay(
      "2026-11-01",
      "America/Bogota",
    );
    expect(from).toBe("2026-11-01 05:00:00");
    expect(to).toBe("2026-11-02 04:59:59");
  });
});
