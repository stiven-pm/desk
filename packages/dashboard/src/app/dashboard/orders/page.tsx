"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { CommerceBuyer } from "@chatbot/domain";

type Fulfillment = {
  mode: "pickup" | "delivery";
  fullName?: string;
  phone?: string;
  city?: string;
  address?: string;
  extra?: string;
  capturedAt?: string;
};

type Order = {
  id: string;
  public_ref: string | null;
  currency: string;
  subtotal_cents: number;
  summary: string;
  buyer_json: string | null;
  fulfillment_json: string | null;
  lines_json: string | null;
  created_at: string;
};

type DeliveryFilter = "all" | "pickup" | "delivery" | "pending_delivery_info";
type SortOrder = "desc" | "asc";

function parseFulfillment(raw: string | null): Fulfillment | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Fulfillment;
  } catch {
    return null;
  }
}

function parseBuyer(raw: string | null): CommerceBuyer | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as CommerceBuyer;
  } catch {
    return null;
  }
}

function formatBuyerLines(buyer: CommerceBuyer | null): string[] {
  if (!buyer) return [];
  const lines: string[] = [];
  if (buyer.name?.trim()) lines.push(`Nombre: ${buyer.name.trim()}`);
  if (buyer.documentId?.trim()) {
    lines.push(`Documento: ${buyer.documentId.trim()}`);
  }
  if (buyer.phone?.trim()) lines.push(`Teléfono: ${buyer.phone.trim()}`);
  if (buyer.city?.trim()) lines.push(`Ciudad: ${buyer.city.trim()}`);
  if (buyer.address?.trim()) lines.push(`Dirección: ${buyer.address.trim()}`);
  if (buyer.companyName?.trim()) {
    lines.push(`Empresa: ${buyer.companyName.trim()}`);
  }
  if (buyer.taxId?.trim()) lines.push(`NIT: ${buyer.taxId.trim()}`);
  return lines;
}

function startOfTodayLocal(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayLocal(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function formatLines(linesJson: string | null): string {
  if (!linesJson) return "";
  try {
    const lines = JSON.parse(linesJson) as Array<{
      name?: string;
      quantity?: number;
      priceCents?: number;
    }>;
    return lines
      .map((l) => `${l.quantity ?? 1}× ${l.name ?? "Ítem"}`)
      .join(" · ");
  } catch {
    return linesJson;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOnly, setTodayOnly] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [sort, setSort] = useState<SortOrder>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("sort", sort);
    if (deliveryFilter !== "all") params.set("mode", deliveryFilter);
    if (todayOnly) {
      params.set("from", startOfTodayLocal());
      params.set("to", endOfTodayLocal());
    } else {
      if (fromDate) params.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
      if (toDate) params.set("to", new Date(`${toDate}T23:59:59`).toISOString());
    }
    const d = await api<{ orders: Order[] }>(
      `/v1/admin/sales-orders?${params.toString()}`,
    );
    setOrders(d.orders);
  }, [sort, deliveryFilter, todayOnly, fromDate, toDate]);

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Error al cargar"),
    );
  }, [load]);

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold">Ventas</h1>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Solo ventas con pago confirmado. Orden de llegada, filtros por fecha y tipo de
        entrega.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setTodayOnly((v) => !v);
            if (!todayOnly) {
              setFromDate("");
              setToDate("");
            }
          }}
          className={[
            "rounded-full px-3 py-1 text-xs border",
            todayOnly
              ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
              : "border-[var(--border)] text-[var(--muted)]",
          ].join(" ")}
        >
          Hoy
        </button>
        {(
          [
            ["all", "Todas"],
            ["pickup", "En tienda"],
            ["delivery", "Domicilio"],
            ["pending_delivery_info", "Sin datos de envío"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDeliveryFilter(id)}
            className={[
              "rounded-full px-3 py-1 text-xs border",
              deliveryFilter === id
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--border)] text-[var(--muted)]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--muted)]">
          Desde
          <input
            type="date"
            disabled={todayOnly}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded-md border border-[var(--border)] px-2 py-1 text-sm text-[var(--foreground)] disabled:opacity-50"
          />
        </label>
        <label className="text-xs text-[var(--muted)]">
          Hasta
          <input
            type="date"
            disabled={todayOnly}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded-md border border-[var(--border)] px-2 py-1 text-sm text-[var(--foreground)] disabled:opacity-50"
          />
        </label>
        <label className="text-xs text-[var(--muted)]">
          Orden
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOrder)}
            className="mt-1 block rounded-md border border-[var(--border)] px-2 py-1 text-sm"
          >
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguas primero</option>
          </select>
        </label>
      </div>

      <ul className="mt-6 space-y-2">
        {orders.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay ventas confirmadas con estos filtros.</p>
        ) : null}
        {orders.map((o) => {
          const fulfillment = parseFulfillment(o.fulfillment_json);
          const deliveryLabel = fulfillment
            ? fulfillment.mode === "pickup"
              ? "En tienda"
              : "Domicilio"
            : "Sin datos de envío";
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelectedId(o.id)}
                className="w-full rounded-md border border-[var(--border)] px-4 py-3 text-left text-sm hover:bg-[var(--muted-bg)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {o.public_ref ?? o.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{deliveryLabel}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">
                  {o.summary || formatLines(o.lines_json)}
                </p>
                <p className="mt-1 text-xs font-medium">
                  {(o.subtotal_cents / 100).toLocaleString("es-CO")} {o.currency}
                  <span className="font-normal text-[var(--muted)]">
                    {" "}
                    · {new Date(o.created_at).toLocaleString("es-CO")}
                  </span>
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold">
                Venta {selected.public_ref ?? selected.id.slice(0, 8)}
              </h2>
              <button
                type="button"
                className="text-xs text-[var(--muted)] underline"
                onClick={() => setSelectedId(null)}
              >
                Cerrar
              </button>
            </div>
            <p className="mt-2 text-sm">{selected.summary}</p>
            <p className="mt-2 text-sm font-medium">
              {(selected.subtotal_cents / 100).toLocaleString("es-CO")}{" "}
              {selected.currency}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {new Date(selected.created_at).toLocaleString("es-CO")}
            </p>
            {formatLines(selected.lines_json) ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                {formatLines(selected.lines_json)}
              </p>
            ) : null}
            {(() => {
              const buyerLines = formatBuyerLines(parseBuyer(selected.buyer_json));
              if (!buyerLines.length) return null;
              return (
                <div className="mt-4 rounded-md border border-[var(--border)] p-3 text-sm">
                  <p className="font-medium">Comprador</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                    {buyerLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            {(() => {
              const f = parseFulfillment(selected.fulfillment_json);
              if (!f) {
                return (
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    El cliente aún no indicó si es recogida en tienda o domicilio.
                  </p>
                );
              }
              return (
                <div className="mt-4 rounded-md border border-[var(--border)] p-3 text-sm">
                  <p className="font-medium">
                    {f.mode === "pickup" ? "Recoger en tienda" : "Envío a domicilio"}
                  </p>
                  {f.mode === "pickup" ? (
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                      {f.fullName ? <li>Nombre: {f.fullName}</li> : null}
                      {f.phone ? <li>Tel: {f.phone}</li> : null}
                    </ul>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                      <li>Nombre: {f.fullName}</li>
                      <li>Tel: {f.phone}</li>
                      <li>Ciudad: {f.city}</li>
                      <li>Dirección: {f.address}</li>
                      {f.extra ? <li>Extra: {f.extra}</li> : null}
                    </ul>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-xs text-red-600" role="alert">{error}</p>
      )}
    </main>
  );
}
