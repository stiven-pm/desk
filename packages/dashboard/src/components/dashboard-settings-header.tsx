"use client";

import Link from "next/link";
import { DashboardProfileMenu } from "@/components/dashboard-profile-menu";

/** Cabecera de la vista de configuración (sin tabs del panel). */
export function DashboardSettingsHeader() {
  return (
    <header
      className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--muted-bg)]/40 px-4 py-3 sm:px-6"
      aria-label="Configuración"
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard/metrics"
          className="shrink-0 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          ← Volver
        </Link>
        <span className="hidden text-[var(--border)] sm:inline" aria-hidden>
          |
        </span>
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
          Configuración
        </p>
      </div>
      <DashboardProfileMenu />
    </header>
  );
}
