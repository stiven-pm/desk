import type { CommerceBuyer } from "@chatbot/domain";
import { CommerceService } from "./commerce-service";

export async function handleCommerceDoRequest(
  svc: CommerceService,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/commerce/cart" && request.method === "GET") {
    return Response.json({
      cart: svc.getCart(),
      buyer: svc.getBuyer(),
      buyerConsentAt: svc.getBuyerConsentAt(),
    });
  }

  if (path === "/commerce/cart" && request.method === "POST") {
    const body = (await request.json()) as {
      action?: string;
      productId?: string;
      name?: string;
      priceCents?: number;
      quantity?: number;
      currency?: string;
      imageUrl?: string;
      lineNotes?: string;
    };
    if (body.action === "update" && body.productId != null) {
      const cart = await svc.cartUpdate(
        String(body.productId),
        Number(body.quantity ?? 0),
      );
      return Response.json({ ok: true, cart });
    }
    if (!body.productId || !body.name) {
      return new Response("bad_request", { status: 400 });
    }
    const added = await svc.cartAdd({
      productId: String(body.productId),
      name: String(body.name),
      priceCents:
        body.priceCents != null ? Number(body.priceCents) : undefined,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      currency: body.currency != null ? String(body.currency) : undefined,
      imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
      lineNotes: body.lineNotes != null ? String(body.lineNotes) : undefined,
    });
    if (!added.ok) {
      return Response.json(added, { status: 400 });
    }
    return Response.json({ ok: true, cart: added.cart });
  }

  if (path === "/commerce/buyer" && request.method === "POST") {
    const body = (await request.json()) as CommerceBuyer & {
      consentAccepted?: boolean;
    };
    if (!body?.type) return new Response("bad_request", { status: 400 });
    if (body.consentAccepted) svc.recordBuyerConsent();
    const prev = svc.getBuyer() ?? { type: body.type };
    const { consentAccepted: _c, ...buyerFields } = body;
    const buyer = { ...prev, ...buyerFields };
    svc.setBuyer(buyer);
    const valid = svc.validateBuyer(buyer);
    return Response.json({
      ok: true,
      buyer,
      valid,
      buyerConsentAt: svc.getBuyerConsentAt(),
    });
  }

  if (path === "/commerce/submit-order" && request.method === "POST") {
    const result = await svc.submitOrder();
    return Response.json(result);
  }

  if (path === "/commerce/start-checkout" && request.method === "POST") {
    let idempotencyKey: string | undefined;
    let confirmPriceChange: boolean | undefined;
    let confirmCartChange: boolean | undefined;
    let turnstileToken: string | undefined;
    try {
      const body = (await request.json()) as {
        idempotencyKey?: string;
        confirmPriceChange?: boolean;
        confirmCartChange?: boolean;
        turnstileToken?: string;
      };
      idempotencyKey = body.idempotencyKey?.trim();
      confirmPriceChange = body.confirmPriceChange === true;
      confirmCartChange = body.confirmCartChange === true;
      turnstileToken = body.turnstileToken?.trim();
    } catch {
      /* empty body ok */
    }
    const result = await svc.startCheckout({
      idempotencyKey,
      confirmPriceChange,
      confirmCartChange,
      turnstileToken,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/commerce/order" && request.method === "GET") {
    const orderId = url.searchParams.get("orderId") ?? undefined;
    const order = await svc.getOrder(orderId);
    return Response.json({ ok: Boolean(order), order });
  }

  if (path === "/commerce/fulfillment" && request.method === "POST") {
    const body = (await request.json()) as {
      mode?: "pickup" | "delivery";
      fullName?: string;
      phone?: string;
      city?: string;
      address?: string;
      extra?: string;
    };
    if (body.mode !== "pickup" && body.mode !== "delivery") {
      return new Response("bad_request", { status: 400 });
    }
    const result = await svc.submitFulfillment(body);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/commerce/payment-return" && request.method === "POST") {
    const body = (await request.json()) as {
      paymentId?: string;
      status?: "paid" | "failed" | "cancelled";
    };
    if (!body.paymentId || !body.status) {
      return new Response("bad_request", { status: 400 });
    }
    await svc.markPaymentReturned(body.paymentId, body.status);
    return Response.json({ ok: true });
  }

  return new Response("not_found", { status: 404 });
}
