import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { apiError, json } from "../lib/http";
import { notifyOrderPaymentEvidenceById } from "../lib/commerce-order-notify";

const bodySchema = z.object({
  orgId: z.string().min(1),
  orderId: z.string().min(1),
});

function authorizeWorker(c: { env: AppEnv["Bindings"]; req: { header: (n: string) => string | undefined } }): boolean {
  const secret = c.env.JWT_SECRET;
  if (!secret) return false;
  const auth = c.req.header("Authorization");
  return auth === `Bearer ${secret}`;
}

export function registerInternalCommerceRoutes(app: Hono<AppEnv>): void {
  app.post("/v1/internal/commerce/notify-pending-payment", async (c) => {
    if (!authorizeWorker(c)) return apiError("unauthorized", 401);

    const parsed = bodySchema.safeParse(await c.req.json());
    if (!parsed.success) return apiError("invalid_body", 400);

    await notifyOrderPaymentEvidenceById(
      c.env,
      parsed.data.orgId,
      parsed.data.orderId,
    );
    return json({ ok: true });
  });
}
