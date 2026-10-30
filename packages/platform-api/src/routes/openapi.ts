import type { Hono } from "hono";
import type { AppEnv } from "../types";

const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Chatbot Platform API",
    version: "1.0.0",
  },
  paths: {
    "/health": { get: { summary: "Health check" } },
    "/v1/admin/auth/register": { post: { summary: "Register org" } },
    "/v1/admin/auth/login": { post: { summary: "Login" } },
    "/v1/public/meta": { get: { summary: "Public product metadata" } },
    "/v1/tenant/sources/upload": { post: { summary: "Upload RAG source" } },
    "/webhooks/creem": { post: { summary: "Creem billing webhook" } },
  },
};

export function registerOpenApiRoutes(app: Hono<AppEnv>): void {
  app.get("/openapi.json", (c) => c.json(openApiSpec));
  app.get("/docs", (c) =>
    c.html(
      `<!DOCTYPE html><html><head><title>API Docs</title>
      <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </head><body>
      <script id="api-reference" data-url="/openapi.json"></script>
      </body></html>`,
    ),
  );
}
