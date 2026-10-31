import { describe, expect, it } from "vitest";
import {
  bucketConversationsByLocalDay,
  localDayKeyFromUtcStorage,
  parseD1UtcTimestamp,
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
});
