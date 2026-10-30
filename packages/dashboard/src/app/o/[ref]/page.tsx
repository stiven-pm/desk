"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

function PublicOrderPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ref = String(params.ref ?? "");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromPayment = searchParams.get("from_payment") === "1";
  const legacyPaymentReturn = searchParams.get("payment_return") === "1";

  useEffect(() => {
    if (legacyPaymentReturn && ref) {
      const api = requireApiUrl();
      const qs = searchParams.toString();
      const apiReturn = `${api}/v1/public/orders/${encodeURIComponent(ref)}/payment-return${qs ? `?${qs}` : ""}`;
      window.location.replace(apiReturn);
    }
  }, [legacyPaymentReturn, ref, searchParams]);

  useEffect(() => {
    if (!ref || legacyPaymentReturn) return;
    const base = requireApiUrl();

    const load = () =>
      fetch(`${base}/v1/public/orders/${encodeURIComponent(ref)}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "not_found");
          setOrder(data as OrderView);
        })
        .catch(() => setError("Pedido no encontrado."));

    void load();
    if (!fromPayment) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [ref, legacyPaymentReturn, fromPayment]);

  if (legacyPaymentReturn) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
        Volviendo al resumen del pedido…
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
      {fromPayment && order.status === "paid" ? (
        <p className="mt-4 text-sm text-emerald-800">
          Pago recibido. Puedes volver al chat de tu tienda para seguir comprando.
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
