import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { json } from "../lib/http";
import { signupsOpen } from "../lib/auth";

/** Public API surface (chat web hosted / widget). */
export function registerPublicRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/public/meta", (c) =>
    json({
      product: "desk",
      channels: ["web"],
      signupsOpen: signupsOpen(c.env),
      appUrl: c.env.APP_URL ?? null,
    }),
  );
}
