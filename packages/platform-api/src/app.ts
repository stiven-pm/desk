import { Hono } from "hono";
import type { AppEnv } from "./types";
import { panelCorsMiddleware } from "./middleware/cors";
import { requestIdMiddleware } from "./middleware/request-id";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { registerPublicRoutes } from "./routes/public";
import { registerTenantRoutes } from "./routes/tenant";
import { registerWebhookRoutes } from "./routes/webhooks";
import { registerOpenApiRoutes } from "./routes/openapi";
import { registerOpsRoutes } from "./routes/ops";
import { registerInviteRoutes } from "./routes/invites";
import { registerHumanRoutes } from "./routes/human";
import { registerAdminIntegrationRoutes } from "./routes/admin-integrations";
import { registerAdminCommerceRoutes } from "./routes/admin-commerce";
import { registerAdminDeskIntegrationRoutes } from "./routes/admin-desk-integrations";
import { registerPublicCommerceRoutes } from "./routes/public-commerce";
import { registerPublicChatRoutes } from "./routes/public-chat";
import { registerPublicStorefrontRoutes } from "./routes/public-storefront";
import { registerInternalCommerceRoutes } from "./routes/internal-commerce";
import { registerOAuthRoutes } from "./routes/oauth";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerCatalogAssetRoutes } from "./routes/catalog-assets";
import { registerAdminSetupAgentRoutes } from "./routes/admin-setup-agent";
import { registerAdminAccountRoutes } from "./routes/admin-account";
import { registerAdminWebRoutes } from "./routes/admin-web";
import { json } from "./lib/http";
import { logStructured } from "./lib/analytics";
import { activeSubscriptionMiddleware } from "./middleware/active-subscription";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", requestIdMiddleware);
  app.use("*", panelCorsMiddleware());
  app.use("*", activeSubscriptionMiddleware);

  app.get("/health", (c) =>
    json({
      status: "ok",
      product: "desk",
      env: c.env.CHATBOT_ENV ?? "production",
    }),
  );

  registerOpenApiRoutes(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerAdminWebRoutes(app);
  registerAdminAccountRoutes(app);
  registerAdminIntegrationRoutes(app);
  registerAdminCommerceRoutes(app);
  registerAdminDeskIntegrationRoutes(app);
  registerAdminSetupAgentRoutes(app);
  registerOAuthRoutes(app);
  registerAnalyticsRoutes(app);
  registerCatalogAssetRoutes(app);
  registerPublicRoutes(app);
  registerPublicChatRoutes(app);
  registerPublicStorefrontRoutes(app);
  registerPublicCommerceRoutes(app);
  registerInternalCommerceRoutes(app);
  registerTenantRoutes(app);
  registerWebhookRoutes(app);
  registerOpsRoutes(app);
  registerInviteRoutes(app);
  registerHumanRoutes(app);

  app.notFound((c) => c.json({ error: "not_found", code: "not_found" }, 404));

  app.onError((err, c) => {
    logStructured("error", {
      message: err.message,
      request_id: c.get("requestId"),
    });
    return c.json({ error: "request_failed", code: "request_failed" }, 500);
  });

  return app;
}
