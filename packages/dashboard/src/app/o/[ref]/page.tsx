"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { requireApiUrl } from "@/lib/config";

type OrderView = {
  publicRef: string;
  status: string;
  currency: string;
  subtotalCents: number;
  summary: string;
  lines: Array<{ name: string; quantity: number; priceCents: number }>;
  chatReturnUrl?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Esperando pago en la pasarela",
  paid: "Pagado",
  failed: "Pago fallido",
  cancelled: "Cancelado",
};

const TERMINAL_STATUSES = new Set(["paid", "failed", "cancelled"]);

function PublicOrderPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ref = String(params.ref ?? "");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollMsRef = useRef(6000);

  const fromPayment = searchParams.get("from_payment") === "1";
  const legacyPaymentReturn = searchParams.get("payment_return") === "1";
  const paymentId = searchParams.get("paymentId");
  const returnTx = searchParams.get("id");

  useEffect(() => {
    if (legacyPaymentReturn && ref) {
      const api = requireApiUrl();
      const qs = searchParams.toString();
      const apiReturn = `${api}/v1/public/orders/${encodeURIComponent(ref)}/payment-return${qs ? `?${qs}` : ""}`;
      window.location.replace(apiReturn);
    }
  }, [legacyPaymentReturn, ref, searchParams]);

  useEffect(() => {
    if (!fromPayment || !ref || legacyPaymentReturn) return;
    let cancelled = false;
    void (async () => {
      const base = requireApiUrl();
      const res = await fetch(`${base}/v1/public/orders/${encodeURIComponent(ref)}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as OrderView;
      if (!data.chatReturnUrl || cancelled) return;
      const u = new URL(data.chatReturnUrl);
      u.searchParams.set("checkout_return", "1");
      u.searchParams.set("order", ref);
      if (paymentId) u.searchParams.set("paymentId", paymentId);
      if (returnTx) u.searchParams.set("id", returnTx);
      window.location.replace(u.toString());
    })();
    return () => {
      cancelled = true;
    };
  }, [fromPayment, ref, legacyPaymentReturn, paymentId, returnTx]);

  useEffect(() => {
    if (!ref || legacyPaymentReturn || fromPayment) return;
    const base = requireApiUrl();
    let cancelled = false;
    let timer: number | undefined;

    const load = async (): Promise<boolean> => {
      const res = await fetch(`${base}/v1/public/orders/${encodeURIComponent(ref)}`);
      if (res.status === 429) {
        pollMsRef.current = Math.min(pollMsRef.current * 1.5, 30000);
        return false;
      }
      pollMsRef.current = 6000;
      const data = await res.json();
      if (!res.ok) {
        if (!order) setError("Pedido no encontrado.");
        return true;
      }
      setError(null);
      const next = data as OrderView;
      setOrder(next);
      return TERMINAL_STATUSES.has(next.status);
    };

    const schedule = (stop: boolean) => {
      if (cancelled || stop || !fromPayment) return;
      timer = window.setTimeout(async () => {
        const done = await load();
        schedule(done);
      }, pollMsRef.current);
    };

    void (async () => {
      if (fromPayment) {
        await fetch(`${base}/v1/public/orders/${encodeURIComponent(ref)}/reconcile-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: paymentId ?? undefined }),
        }).catch(() => undefined);
      }
      const done = await load();
      schedule(done);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [ref, legacyPaymentReturn, fromPayment, paymentId]);

  if (legacyPaymentReturn || fromPayment) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
        Volviendo al chat…
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
        {error}
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
        Cargando pedido…
      </main>
    );
  }

  const total = (order.subtotalCents / 100).toLocaleString("es-CO");

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-xl font-semibold">Pedido {order.publicRef}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{order.summary}</p>
      <p className="mt-4 text-lg font-medium">
        Total: {total} {order.currency}
      </p>
      <p className="mt-2 text-sm">
        {STATUS_LABEL[order.status] ?? order.status}
      </p>
      {fromPayment && order.status === "awaiting_payment" ? (
        <p className="mt-4 text-xs text-[var(--muted)]">
          Confirmando el pago con la pasarela… esta página se actualiza sola.
        </p>
      ) : null}
      {order.status === "paid" && order.chatReturnUrl ? (
        <p className="mt-6">
          <Link
            href={order.chatReturnUrl}
            className="text-sm font-medium text-emerald-800 underline"
          >
            Volver al chat
          </Link>
        </p>
      ) : null}
    </main>
  );
}

export default function PublicOrderPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
          Cargando pedido…
        </main>
      }
    >
      <PublicOrderPageInner />
    </Suspense>
  );
}
