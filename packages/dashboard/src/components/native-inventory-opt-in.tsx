"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useNativeInventory } from "@/lib/use-native-inventory";

export function NativeInventoryOptIn() {
  const { enabled, productCount, refresh } = useNativeInventory();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api("/v1/admin/commerce-inventory-mode", {
        method: "PATCH",
        body: JSON.stringify({ enabled: next }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mb-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
      aria-labelledby="native-inventory-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            id="native-inventory-title"
            className="native-inventory-gradient-label text-[11px] font-medium leading-snug"
          >
            ¿Necesitas gestión de inventario?
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Si vendes por redes sin tienda ni backend, activa el catálogo en Desk:
            productos, stock, promos e imágenes para que el asistente venda en el chat
            con tu pasarela.
          </p>
          {enabled && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/products"
                className="inline-flex rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Abrir catálogo
              </Link>
              <span className="text-xs text-[var(--muted)]">
                {productCount > 0
                  ? `${productCount} producto${productCount === 1 ? "" : "s"} publicado${productCount === 1 ? "" : "s"}`
                  : "Sin productos publicados aún"}
              </span>
            </div>
          )}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">{enabled ? "Sí" : "No"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={() => void toggle(!enabled)}
            className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
              enabled ? "bg-emerald-600" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>
      )}
      <p className="mt-2 text-[10px] text-[var(--muted)]">
        Crea productos en Catálogo. Si tienes web con API, Ops puede conectar tu sistema
        y no necesitas este modo.
      </p>
    </section>
  );
}
