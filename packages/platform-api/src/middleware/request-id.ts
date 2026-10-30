import type { Context, Next } from "hono";
import type { AppEnv } from "../types";
import { randomId } from "../lib/http";

export async function requestIdMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<void> {
  const requestId = c.req.header("x-request-id") ?? randomId();
  c.set("requestId", requestId);
  await next();
  c.res.headers.set("x-request-id", requestId);
}
