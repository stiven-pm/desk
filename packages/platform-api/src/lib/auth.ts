import {
  canAccessLegacyRoles,
  resolveMemberCapabilities,
  type MemberCapability,
} from "@chatbot/domain";
import type { AuthScope, Env, SessionUser, TenantUser } from "../types";

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltB64 = btoa(String.fromCharCode(...salt));
  return `pbkdf2:${saltB64}:${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, saltB64, hash] = stored.split(":");
  if (algo !== "pbkdf2") return false;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return computed === hash;
}

export async function createSessionToken(
  user: SessionUser,
  secret: string,
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      scope: user.scope,
      org_id: user.orgId ?? null,
      role: user.role ?? null,
      caps: user.capabilities ?? null,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signature = await hmacSign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionUser | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = await hmacSign(`${header}.${payload}`, secret);
  if (signature !== expected) return null;
  const decoded = JSON.parse(
    atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
  ) as {
    sub: string;
    email: string;
    scope?: AuthScope;
    org_id?: string | null;
    role?: string | null;
    caps?: MemberCapability[] | null;
    exp: number;
  };
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
  const scope = decoded.scope ?? (decoded.org_id ? "tenant" : "ops");
  const capabilities =
    Array.isArray(decoded.caps) && decoded.caps.length
      ? decoded.caps
      : undefined;
  return {
    id: decoded.sub,
    email: decoded.email,
    scope,
    orgId: decoded.org_id ?? undefined,
    role: decoded.role ?? undefined,
    capabilities,
  };
}

export async function requireUser(
  request: Request,
  env: Env,
): Promise<{ user: TenantUser } | { response: Response }> {
  const token = getBearerToken(request);
  if (!token) {
    return { response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) };
  }
  const user = await verifySessionToken(token, env.JWT_SECRET);
  if (!user || user.scope !== "tenant" || !user.orgId) {
    return { response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) };
  }
  return {
    user: user as TenantUser,
  };
}

export async function loadMembershipAccess(
  env: Env,
  orgId: string,
  userId: string,
): Promise<{ role: string; capabilitiesJson: string | null } | null> {
  const row = await env.DB.prepare(
    `SELECT role, capabilities_json FROM memberships WHERE org_id = ? AND user_id = ?`,
  )
    .bind(orgId, userId)
    .first<{ role: string; capabilities_json: string | null }>();
  if (!row) return null;
  return { role: row.role, capabilitiesJson: row.capabilities_json };
}

async function enrichTenantCapabilities(
  env: Env,
  user: TenantUser,
): Promise<TenantUser> {
  if (user.capabilities?.length) return user;
  const row = await loadMembershipAccess(env, user.orgId, user.id);
  if (!row) return user;
  const capabilities = resolveMemberCapabilities(
    row.role,
    row.capabilitiesJson,
  );
  return { ...user, role: row.role, capabilities };
}

export async function requireAdminRole(
  request: Request,
  env: Env,
  allowed: string[],
): Promise<{ user: TenantUser } | { response: Response }> {
  const auth = await requireUser(request, env);
  if ("response" in auth) return auth;
  const row = await loadMembershipAccess(env, auth.user.orgId, auth.user.id);
  if (!row) {
    return {
      response: new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
      }),
    };
  }
  if (!canAccessLegacyRoles(row.role, row.capabilitiesJson, allowed)) {
    return {
      response: new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
      }),
    };
  }
  const capabilities = resolveMemberCapabilities(
    row.role,
    row.capabilitiesJson,
  );
  return {
    user: {
      ...auth.user,
      role: row.role,
      capabilities,
    },
  };
}

export async function requireCapability(
  request: Request,
  env: Env,
  needed: MemberCapability,
): Promise<{ user: TenantUser } | { response: Response }> {
  const auth = await requireUser(request, env);
  if ("response" in auth) return auth;
  const user = await enrichTenantCapabilities(env, auth.user);
  const caps =
    user.capabilities ??
    resolveMemberCapabilities(user.role, null);
  if (!caps.includes(needed)) {
    return {
      response: new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
      }),
    };
  }
  return { user: { ...user, capabilities: caps } };
}

export function signupsOpen(env: Env): boolean {
  return (env.SIGNUPS_OPEN ?? "true").toLowerCase() !== "false";
}
