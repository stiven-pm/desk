import type { Context, Next } from "hono";
import type { AppEnv, Env } from "../types";

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

function localDevOrigins(env: Env): string[] {
  const chatbotEnv = env.CHATBOT_ENV ?? "production";
  if (chatbotEnv === "production" || chatbotEnv === "test") return [];
  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Idempotency-Key, X-Api-Key, X-Request-Id",
    "Access-Control-Max-Age": "86400",
  };
}

export function panelCorsMiddleware() {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.req.header("Upgrade")?.toLowerCase() === "websocket") {
      return next();
    }
    const origin = c.req.header("Origin") ?? "";
    const allowed = new Set(
      [c.env.APP_URL, c.env.OPS_APP_URL, ...localDevOrigins(c.env)]
        .filter(Boolean)
        .map((o) => normalizeOrigin(String(o))),
    );
    const normalizedOrigin = origin ? normalizeOrigin(origin) : "";
    const isAllowed =
      (normalizedOrigin && allowed.has(normalizedOrigin)) ||
      origin.endsWith(".workers.dev") ||
      origin.endsWith(".pages.dev");

    if (c.req.method === "OPTIONS") {
      if (!isAllowed || !origin) return new Response(null, { status: 204 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    await next();

    if (c.res.status === 101) return;

    if (isAllowed && origin) {
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        c.res.headers.set(k, v);
      }
    }
  };
}

export function publicCorsMiddleware(allowedOrigins: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const origin = c.req.header("Origin") ?? "";
    const allowed = new Set(allowedOrigins);
    const isAllowed = origin && allowed.has(origin);

    if (c.req.method === "OPTIONS") {
      if (!isAllowed) return new Response(null, { status: 204 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    await next();

    if (isAllowed) {
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        c.res.headers.set(k, v);
      }
    }
  };
}
