import type { Env, OpsUser } from "../types";
import {
  getBearerToken,
  verifySessionToken,
  createSessionToken,
  hashPassword,
} from "./auth";

export function bootstrapEmails(env: Env): Set<string> {
  const raw = env.OPS_BOOTSTRAP_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function ensureOpsUser(env: Env, email: string): Promise<OpsUser> {
  const normalized = email.toLowerCase();
  const existing = await env.DB.prepare(
    `SELECT id, email FROM users WHERE email = ?`,
  )
    .bind(normalized)
    .first<{ id: string; email: string }>();

  let userId = existing?.id;
  if (!userId) {
    userId = crypto.randomUUID();
    const passwordHash = await hashPassword(env.OPS_BOOTSTRAP_PASSWORD!);
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
    )
      .bind(userId, normalized, passwordHash)
      .run();
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO platform_admins (user_id) VALUES (?)`,
  )
    .bind(userId)
    .run();

  return {
    id: userId,
    email: normalized,
    scope: "ops",
    role: "platform_admin",
  };
}

export async function isPlatformAdmin(env: Env, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT user_id FROM platform_admins WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  return Boolean(row);
}

export async function requireOps(
  request: Request,
  env: Env,
): Promise<{ user: OpsUser } | { response: Response }> {
  const token = getBearerToken(request);
  if (!token) {
    return {
      response: new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
      }),
    };
  }
  const user = await verifySessionToken(token, env.JWT_SECRET);
  if (!user || user.scope !== "ops") {
    return {
      response: new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
      }),
    };
  }
  return { user: user as OpsUser };
}

/** Ops login: email in OPS_BOOTSTRAP_ADMIN_EMAILS + password === OPS_ADMIN_PASSWORD (Worker secret). */
export async function opsLogin(
  env: Env,
  email: string,
  password: string,
): Promise<OpsUser | null> {
  const configured = env.OPS_BOOTSTRAP_PASSWORD?.trim();
  if (!configured) return null;

  const normalized = email.toLowerCase();
  if (!bootstrapEmails(env).has(normalized)) return null;
  if (!constantTimeEqual(password, configured)) return null;

  return ensureOpsUser(env, normalized);
}

export async function createOpsToken(env: Env, user: OpsUser): Promise<string> {
  return createSessionToken(
    {
      id: user.id,
      email: user.email,
      scope: "ops",
      role: user.role,
    },
    env.JWT_SECRET,
  );
}
