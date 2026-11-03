import type { VisitorSessionContext } from "@chatbot/domain";
import type { Env } from "../types";

type CfGeo = {
  timezone?: string;
  city?: string;
  region?: string;
  country?: string;
};

function localIsoInTimezone(tz: string): string | undefined {
  try {
    return new Date().toLocaleString("es", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return undefined;
  }
}

/** Approximate session context from Cloudflare edge headers only (no third-party IP geo). */
export async function resolveVisitorSessionContext(
  _env: Env,
  _ip: string,
  cf?: CfGeo,
): Promise<VisitorSessionContext> {
  if (!cf?.timezone && !cf?.city && !cf?.country) return {};
  const ctx: VisitorSessionContext = {
    timezone: cf.timezone,
    city: cf.city,
    region: cf.region,
    country: cf.country,
  };
  if (ctx.timezone) {
    ctx.localIso = localIsoInTimezone(ctx.timezone);
  }
  return ctx;
}
