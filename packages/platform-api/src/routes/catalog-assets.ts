import type { Hono } from "hono";
import type { AppEnv } from "../types";

const SAFE_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;

export function catalogAssetR2Key(orgId: string, fileName: string): string {
  return `product-images/${orgId}/${fileName}`;
}

export function catalogAssetPublicUrl(
  apiBase: string,
  orgId: string,
  fileName: string,
): string {
  const base = apiBase.replace(/\/$/, "");
  return `${base}/v1/catalog-assets/${orgId}/${encodeURIComponent(fileName)}`;
}

export function registerCatalogAssetRoutes(app: Hono<AppEnv>): void {
  app.get("/v1/catalog-assets/:orgId/:fileName", async (c) => {
    const orgId = c.req.param("orgId");
    const fileName = decodeURIComponent(c.req.param("fileName"));
    if (!orgId || !SAFE_FILE.test(fileName)) {
      return c.text("not_found", 404);
    }
    const key = catalogAssetR2Key(orgId, fileName);
    const obj = await c.env.SOURCES.get(key);
    if (!obj) return c.text("not_found", 404);
    const headers = new Headers();
    const ct = obj.httpMetadata?.contentType ?? "application/octet-stream";
    headers.set("Content-Type", ct);
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(obj.body, { status: 200, headers });
  });
}
