/** IANA por org para métricas y cortes de día (D1 guarda timestamps en UTC). */
export const DEFAULT_ORG_TIMEZONE = "America/Bogota";

/** Zonas admitidas en registro / ops / cuenta (IANA). */
export const ORG_TIMEZONE_OPTIONS = [
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil)" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/New_York", label: "Este EE. UU." },
  { value: "America/Los_Angeles", label: "Pacífico EE. UU." },
  { value: "Europe/Madrid", label: "España (Madrid)" },
  { value: "UTC", label: "UTC" },
] as const;

export function formatOrgTimezoneLabel(timeZone: string): string {
  const hit = ORG_TIMEZONE_OPTIONS.find((o) => o.value === timeZone);
  return hit?.label ?? timeZone.replace(/_/g, " ");
}

export function isAllowedOrgTimezone(value: string): boolean {
  return ORG_TIMEZONE_OPTIONS.some((o) => o.value === value);
}

/** Parsea `created_at` de D1/SQLite (`YYYY-MM-DD HH:MM:SS`) como UTC. */
export function parseD1UtcTimestamp(raw: string): Date {
  const s = raw.trim();
  if (!s) return new Date(Number.NaN);
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(`${s.replace(" ", "T")}Z`);
}

/** Clave `YYYY-MM-DD` del instante en la zona indicada. */
export function localDayKeyFromUtcStorage(
  raw: string | Date,
  timeZone: string,
): string {
  const d = raw instanceof Date ? raw : parseD1UtcTimestamp(raw);
  if (Number.isNaN(d.getTime())) return "";
  const tz = timeZone.trim() || DEFAULT_ORG_TIMEZONE;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function bucketConversationsByLocalDay(
  rows: Array<{ created_at: string }>,
  timeZone: string,
  opts?: { maxDays?: number; throughLocalDay?: string },
): Array<{ day: string; conversations: number }> {
  const tz = timeZone.trim() || DEFAULT_ORG_TIMEZONE;
  const through =
    opts?.throughLocalDay?.trim() ||
    localDayKeyFromUtcStorage(new Date(), tz);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = localDayKeyFromUtcStorage(row.created_at, tz);
    if (!day || day > through) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  let days = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, conversations]) => ({ day, conversations }));
  const maxDays = opts?.maxDays ?? 14;
  if (days.length > maxDays) {
    days = days.slice(-maxDays);
  }
  return days;
}

export function resolveOrgTimezone(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return DEFAULT_ORG_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return DEFAULT_ORG_TIMEZONE;
  }
}

/** SQLite/D1 `datetime('now')` shape in UTC (`YYYY-MM-DD HH:MM:SS`). */
export function formatUtcForD1Storage(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function findLocalDayStartUtcMs(localDayYmd: string, timeZone: string): number {
  const [y, m, d] = localDayYmd.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return Number.NaN;
  let lo = Date.UTC(y, m - 1, d) - 36 * 3600 * 1000;
  let hi = Date.UTC(y, m - 1, d) + 36 * 3600 * 1000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const key = localDayKeyFromUtcStorage(new Date(mid), timeZone);
    if (key < localDayYmd) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Rango UTC en formato D1 para un día calendario en la zona de la org. */
export function utcD1RangeForOrgLocalDay(
  localDayYmd: string,
  timeZone: string,
): { from: string; to: string } {
  const tz = resolveOrgTimezone(timeZone);
  const startMs = findLocalDayStartUtcMs(localDayYmd, tz);
  const nextDay = localDayKeyFromUtcStorage(
    new Date(startMs + 25 * 3600 * 1000),
    tz,
  );
  const endMs = findLocalDayStartUtcMs(nextDay, tz) - 1000;
  return {
    from: formatUtcForD1Storage(new Date(startMs)),
    to: formatUtcForD1Storage(new Date(endMs)),
  };
}

export function utcD1RangeForOrgLocalToday(timeZone: string): {
  from: string;
  to: string;
} {
  const tz = resolveOrgTimezone(timeZone);
  const today = localDayKeyFromUtcStorage(new Date(), tz);
  return utcD1RangeForOrgLocalDay(today, tz);
}

/** Fecha/hora para UI admin (D1 UTC → zona de la org). */
export function formatOrgDateTime(
  raw: string | Date,
  timeZone: string,
): string {
  const d = raw instanceof Date ? raw : parseD1UtcTimestamp(raw);
  if (Number.isNaN(d.getTime())) return raw instanceof Date ? "" : String(raw);
  const tz = resolveOrgTimezone(timeZone);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(d);
}
