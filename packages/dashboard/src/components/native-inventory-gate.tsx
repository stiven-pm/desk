"use client";

import Link from "next/link";
import { useNativeInventory } from "@/lib/use-native-inventory";

export function NativeInventoryGate({ children }: { children: React.ReactNode }) {
  const { enabled, loading } = useNativeInventory();

  if (loading) {
    return (
      <p className="px-6 py-10 text-sm text-[var(--muted)]">Cargando catálogo…</p>
    );
  }

  if (!enabled) {
    return (
      <main className="mx-auto max-w-lg px-6 py-12 text-center">
        <h1 className="text-lg font-semibold">Catálogo no disponible</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Activa la gestión de inventario en Integraciones. Tus productos guardados
          siguen en el sistema y vuelven a mostrarse al reactivar.
        </p>
        <Link
          href="/dashboard/configuracion?tab=integraciones"
          className="mt-6 inline-block rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Ir a Integraciones
        </Link>
      </main>
    );
  }

  return children;
}
