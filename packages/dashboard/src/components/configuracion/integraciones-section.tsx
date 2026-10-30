"use client";

import { useSearchParams } from "next/navigation";
import { DeskIntegrationsPanel } from "@/components/desk-integrations-panel";
import { NativeInventoryOptIn } from "@/components/native-inventory-opt-in";

export function ConfiguracionIntegracionesSection() {
  const searchParams = useSearchParams();
  const inventoryOff = searchParams.get("inventory") === "off";

  return (
    <div className="mt-8">
      {inventoryOff && (
        <p
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="status"
        >
          El catálogo está desactivado. Activa inventario abajo para entrar a
          productos; lo que ya guardaste no se borra.
        </p>
      )}
      <p className="text-sm text-[var(--muted)]">
        Pasarelas de pago y conexiones habilitadas para tu negocio. El webhook de
        cobros aparece en cada pasarela al activarla.
      </p>
      <div className="mt-6">
        <NativeInventoryOptIn />
        <DeskIntegrationsPanel />
      </div>
    </div>
  );
}
