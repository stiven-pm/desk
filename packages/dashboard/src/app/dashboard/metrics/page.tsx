"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SetupChecklist } from "@/components/setup-checklist";

type Analytics = {
  usage: {
    aiCreditsUsed: number;
    setupCreditsUsed?: number;
    ragMeterCredits?: number;
    messagesCount: number;
  };
  limits: { monthlyAiCredits: number; monthlyMessages: number };
  summary: {
    conversationsLast30Days: number;
    conversationsLast7Days?: number;
    handoffsLast30Days: number;
    ordersPaidLast30Days?: number;
    checkoutsStartedLast30Days?: number;
    ordersTotalLast30Days?: number;
    revenuePaidCentsLast30Days?: number;
    checkoutConversionPct?: number | null;
    conversationsHandledByAiEstimate?: number;
    clientMessagesThisMonth?: number;
  };
  conversationsByDay: Array<{ day: string; conversations: number }>;
};

function pct(used: number, max: number) {
  if (!max) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function moneyCents(cents: number, currency = "COP") {
  return `${(cents / 100).toLocaleString("es-CO")} ${currency}`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    const load = () =>
      api<Analytics>("/v1/admin/analytics", { token }).then(setData);
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return <p className="p-6 text-sm">Cargando inicio…</p>;
  }

  const metered =
    data.usage.aiCreditsUsed +
    (data.usage.setupCreditsUsed ?? 0) +
    (data.usage.ragMeterCredits ?? 0);

  const s = data.summary;
  const conv30 = s.conversationsLast30Days;
  const aiPct =
    conv30 > 0 && s.conversationsHandledByAiEstimate != null
      ? Math.round((s.conversationsHandledByAiEstimate / conv30) * 100)
      : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-sm">
      <h1 className="font-display text-2xl">Inicio</h1>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Ventas confirmadas, conversaciones y uso. Se actualiza cada minuto.
      </p>

      <SetupChecklist className="mt-6" />

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Ventas (30 días)
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            value={moneyCents(s.revenuePaidCentsLast30Days ?? 0)}
            label="Ingresos confirmados"
            hint="Solo pedidos pagados"
          />
          <Metric value={String(s.ordersPaidLast30Days ?? 0)} label="Pedidos pagados" />
          <Metric value={String(s.ordersTotalLast30Days ?? 0)} label="Pedidos totales" />
          <Metric
            value={
              s.checkoutConversionPct != null
                ? `${s.checkoutConversionPct}%`
                : "—"
            }
            label="Conversión checkout → pago"
            hint={
              s.checkoutsStartedLast30Days
                ? `${s.checkoutsStartedLast30Days} checkouts`
                : "Sin checkouts aún"
            }
          />
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Atención
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric value={String(conv30)} label="Conversaciones (30 d)" />
          <Metric value={String(s.conversationsLast7Days ?? 0)} label="Conversaciones (7 d)" />
          <Metric
            value={String(s.conversationsHandledByAiEstimate ?? 0)}
            label="Atendidas por IA (est.)"
            hint={aiPct != null ? `${aiPct}% del total` : undefined}
          />
          <Metric value={String(s.handoffsLast30Days)} label="Derivaciones a humano" />
        </ul>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Desk no mide la resolución fuera del chat.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Uso del plan (mes actual)
        </h2>
        <UsageBar
          label="Mensajes de clientes"
          used={data.usage.messagesCount}
          max={data.limits.monthlyMessages}
        />
        <UsageBar
          label="Créditos de procesamiento"
          used={metered}
          max={data.limits.monthlyAiCredits}
        />
        <Link href="/dashboard/billing" className="text-xs text-[var(--primary)] hover:underline">
          Ver plan y límites →
        </Link>
      </section>

      {data.conversationsByDay.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium">Conversaciones por día</h2>
          <ul className="mt-4 space-y-2">
            {data.conversationsByDay.map((row) => (
              <li key={row.day} className="flex items-center gap-3">
                <span className="w-24 text-xs text-[var(--muted)]">{row.day}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--muted-bg)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${Math.min(
                        100,
                        (row.conversations /
                          Math.max(
                            ...data.conversationsByDay.map((d) => d.conversations),
                            1,
                          )) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs">{row.conversations}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Metric({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
      <p className="text-2xl font-display">{value}</p>
      <p className="text-[var(--muted)]">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p> : null}
    </li>
  );
}

function UsageBar({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span>
          {used.toLocaleString("es")} / {max.toLocaleString("es")}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-[var(--muted-bg)]">
        <div
          className="h-2 rounded-full bg-[var(--primary)]"
          style={{ width: `${pct(used, max)}%` }}
        />
      </div>
    </div>
  );
}
