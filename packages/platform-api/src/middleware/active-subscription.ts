import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { requireUser } from "../lib/auth";
import { apiError } from "../lib/http";

const EXEMPT_PATHS = new Set([
  "/v1/admin/me",
  "/v1/admin/account",
  "/v1/admin/billing/checkout",
  "/v1/admin/billing/payment-status",
]);

const EXEMPT_PREFIXES = ["/v1/admin/account/"];

function isAuthPath(path: string): boolean {
  return path.startsWith("/v1/admin/auth/");
}

/** Blocks panel APIs until org has paid (status active). */
export const activeSubscriptionMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const path = c.req.path;
  if (!path.startsWith("/v1/admin/")) return next();
  if (
    EXEMPT_PATHS.has(path) ||
    isAuthPath(path) ||
    EXEMPT_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return next();
  }

  const auth = await requireUser(c.req.raw, c.env);
  if ("response" in auth) return auth.response;

  const org = await c.env.DB.prepare(`SELECT status FROM orgs WHERE id = ?`)
    .bind(auth.user.orgId)
    .first<{ status: string }>();

  if (!org || org.status !== "active") {
    return apiError("subscription_required", 402);
  }

  return next();
};
