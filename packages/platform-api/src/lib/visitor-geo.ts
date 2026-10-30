import type { VisitorSessionContext } from "@chatbot/domain";
import type { Env } from "../types";

type CfGeo = {
  timezone?: string;
  city?: string;
  region?: string;
  country?: string;
};

function isPublicIp(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  if (ip.includes(":")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) {
    return false;
  }
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
}

function fromCf(cf: CfGeo | undefined): VisitorSessionContext {
  if (!cf) return {};
  return {
    timezone: cf.timezone,
    city: cf.city,
    region: cf.region,
    country: cf.country,
  };
}

async function fetchIpGuide(ip: string): Promise<VisitorSessionContext> {
  const res = await fetch(`https://ip.guide/${ip}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    location?: {
      city?: string | null;
      country?: string | null;
      timezone?: string | null;
    };
  };
  const loc = data.location;
  if (!loc) return {};
  return {
    timezone: loc.timezone ?? undefined,
    city: loc.city ?? undefined,
    country: loc.country ?? undefined,
  };
}

async function fetchIpQuery(ip: string): Promise<VisitorSessionContext> {
  const res = await fetch(`https://api.ipquery.io/${ip}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    location?: {
      city?: string;
      state?: string;
      country?: string;
      country_code?: string;
      timezone?: string;
      localtime?: string;
    };
  };
  const loc = data.location;
  if (!loc) return {};
  return {
    timezone: loc.timezone,
    localIso: loc.localtime,
    city: loc.city,
    region: loc.state,
    country: loc.country,
    countryCode: loc.country_code,
  };
}

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

/** CF edge geo + optional ip.guide / ipquery.io (cached in KV). */
export async function resolveVisitorSessionContext(
  env: Env,
  ip: string,
  cf?: CfGeo,
): Promise<VisitorSessionContext> {
  const fromEdge = fromCf(cf);
  if (fromEdge.timezone && !isPublicIp(ip)) {
    return {
      ...fromEdge,
      localIso: localIsoInTimezone(fromEdge.timezone),
    };
  }

  const cacheKey = isPublicIp(ip) ? `vgeo:${ip}` : null;
  if (cacheKey && env.TENANT_CACHE) {
    const cached = await env.TENANT_CACHE.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as VisitorSessionContext;
      } catch {
        /* refresh */
      }
    }
  }

  let merged: VisitorSessionContext = { ...fromEdge };

  if (isPublicIp(ip)) {
    try {
      const guide = await fetchIpGuide(ip);
      merged = { ...merged, ...guide };
    } catch {
      /* optional provider */
    }
    if (!merged.localIso) {
      try {
        const query = await fetchIpQuery(ip);
        merged = { ...merged, ...query };
      } catch {
        /* optional provider */
      }
    }
  }

  if (merged.timezone && !merged.localIso) {
    merged.localIso = localIsoInTimezone(merged.timezone);
  }

  if (cacheKey && env.TENANT_CACHE && Object.keys(merged).length > 0) {
    await env.TENANT_CACHE.put(cacheKey, JSON.stringify(merged), {
      expirationTtl: 3600,
    });
  }

  return merged;
}
