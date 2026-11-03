"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "@/components/ops-shell";
import { opsApi } from "@/lib/api";

type Overview = {
  orgCount: number;
  activeOrgCount: number;
  mrrUsd: number;
  meteredCreditsMonth: number;
  messagesMonth: number;
  estimatedVariableCostUsd: number;
  periodStart: string;
  note: string;
  costBands: Record<string, number>;
};

export default function OpsMetricsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("ops_token")) {
      window.location.href = "/";
      return;
    }
    opsApi<Overview>("/v1/ops/economics/overview")
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error");
      });
  }, []);

  return (
    <OpsShell>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--ops-muted)]">
          MRR, costes estimados y cupos. Para errores IA/API, p95 de créditos y latencia, abre{" "}
          <a href="/health" className="underline">
            Salud
          </a>
          .
        </p>
        {error && (
          <p className="mt-4 text-sm text-[oklch(0.45_0.15_25)]" role="alert">{error}</p>
        )}
        {!data && !error && (
          <p className="mt-8 text-sm text-[var(--ops-muted)]">Cargando…</p>
        )}
        {data && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="MRR activo (USD)" value={`$${data.mrrUsd.toFixed(0)}`} />
            <Card label="Empresas activas" value={String(data.activeOrgCount)} />
            <Card
              label="Mensajes (mes)"
              value={data.messagesMonth.toLocaleString("es")}
            />
            <Card
              label="Créditos medidos"
              value={data.meteredCreditsMonth.toLocaleString("es")}
            />
            <Card
              label="IA variable est. (interno)"
              value={`$${data.estimatedVariableCostUsd.toFixed(2)}`}
            />
            <Card label="Periodo" value={data.periodStart} />
          </div>
        )}
        {data && (
          <section className="mt-10 rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-5 text-sm">
            <h2 className="font-medium">Bandas USD / 1k créditos (planificación)</h2>
            <ul className="mt-3 space-y-1 text-[var(--ops-muted)]">
              {Object.entries(data.costBands).map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono text-xs">{k}</span>: ${v}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--ops-muted)]">{data.note}</p>
          </section>
        )}
      </main>
    </OpsShell>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-4">
      <p className="text-xs text-[var(--ops-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
