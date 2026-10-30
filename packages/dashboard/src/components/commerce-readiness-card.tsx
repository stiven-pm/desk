"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Readiness = {
  items: Array<{ id: string; label: string; ok: boolean; href: string; hint?: string }>;
  readyToSell: boolean;
  completedCount: number;
  totalCount: number;
};

export function CommerceReadinessCard() {
  const [data, setData] = useState<Readiness | null>(null);

  useEffect(() => {
    api<Readiness>("/v1/admin/commerce-readiness")
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data || data.readyToSell) return null;

  return (
    <section
      className="mt-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
      aria-labelledby="commerce-readiness-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="commerce-readiness-title" className="font-medium">
          Listo para vender
        </h2>
        <span className="text-xs text-[var(--muted)]">
          {data.completedCount} / {data.totalCount} pasos
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Completa el checklist para que el asistente pueda cerrar pedidos con precios
        del catálogo.
      </p>
      <ul className="mt-4 space-y-2">
        {data.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span
              className={
                item.ok ? "text-emerald-600" : "text-[var(--muted)]"
              }
              aria-hidden
            >
              {item.ok ? "✓" : "○"}
            </span>
            <div>
              <Link href={item.href} className="font-medium hover:underline">
                {item.label}
              </Link>
              {item.hint && !item.ok ? (
                <p className="text-xs text-[var(--muted)]">{item.hint}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/dashboard/panel"
        className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
      >
        Ir al panel →
      </Link>
    </section>
  );
}
