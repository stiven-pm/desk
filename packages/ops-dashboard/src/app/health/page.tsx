"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { opsApi } from "@/lib/api";

type HealthOverview = {
  economics: {
    mrrUsd: number;
    activeOrgCount: number;
    messagesMonth: number;
    meteredCreditsMonth: number;
    estimatedVariableCostUsd: number;
    fixedInfraUsdMonth: number;
    creemFeesUsdMonth: number;
    totalEstimatedCostUsdMonth: number;
    estimatedGrossUsdMonth: number;
    estimatedGrossMarginPct: number;
    usageCreditsPerMessageMonthMean: number | null;
    costBandUsdPer1kCredits: number;
  };
  turnQuality7d: TurnQuality;
  turnQuality24h: TurnQuality;
  signals24h: SignalCounts;
  signals7d: SignalCounts;
  reconciliation: {
    cloudflareUsdMtd: number | null;
    deskInfraEstimatedUsdMtd: number;
    deskTotalEstimatedUsdMtd: number;
    creemEstimatedUsdMtd: number;
    deltaInfraUsd: number | null;
    deltaInfraPct: number | null;
    cfFetchedAt: string | null;
    cfPeriodFrom: string | null;
    cfPeriodTo: string | null;
    cfFetchError: string | null;
    cfConfigured: boolean;
    byFamily: Array<{
      family: string;
      usd: number;
      services: Array<{ name: string; usd: number }>;
    }>;
  };
};

type TurnQuality = {
  sampleSize: number;
  windowDays: number;
  creditsPerMessage: { mean: number | null; p50: number | null; p95: number | null };
  durationMs: { mean: number | null; p50: number | null; p95: number | null };
  degradedRatePct: number | null;
};

type SignalCounts = {
  error: number;
  warn: number;
  byCategory: Array<{ category: string; error: number; warn: number }>;
};

type SignalEvent = {
  id: string;
  created_at: string;
  severity: string;
  category: string;
  code: string;
  org_id: string | null;
  org_slug: string | null;
  org_name: string | null;
  request_id: string | null;
  conversation_id: string | null;
  summary: string;
  detail_json: string;
};

export default function OpsHealthPage() {
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [events, setEvents] = useState<SignalEvent[]>([]);
  const [hours, setHours] = useState(24);
  const [severity, setSeverity] = useState<"" | "error" | "warn">("error");
  const [error, setError] = useState<string | null>(null);
  const [cfSyncBusy, setCfSyncBusy] = useState(false);

  const loadOverview = useCallback(
    () => opsApi<HealthOverview>("/v1/ops/health/overview").then(setOverview),
    [],
  );

  async function syncCloudflareBilling() {
    setCfSyncBusy(true);
    try {
      await opsApi("/v1/ops/billing/cloudflare/sync", { method: "POST" });
      await loadOverview();
    } finally {
      setCfSyncBusy(false);
    }
  }

  const loadEvents = useCallback(async () => {
    const q = new URLSearchParams({ hours: String(hours) });
    if (severity) q.set("severity", severity);
    const data = await opsApi<{ events: SignalEvent[] }>(
      `/v1/ops/health/events?${q}`,
    );
    setEvents(data.events);
  }, [hours, severity]);

  useEffect(() => {
    if (!localStorage.getItem("ops_token")) {
      window.location.href = "/";
      return;
    }
    opsApi<HealthOverview>("/v1/ops/health/overview")
      .then(setOverview)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error");
      });
    void loadEvents().catch(() => undefined);
    const t = setInterval(() => {
      void loadOverview();
      void loadEvents();
    }, 60_000);
    return () => clearInterval(t);
  }, [loadEvents, loadOverview]);

  return (
    <OpsShell>
      <main className="mx-auto max-w-6xl px-6 py-10 text-sm">
        <h1 className="font-semibold tracking-tight">Salud de plataforma</h1>
        <p className="mt-1 max-w-3xl text-[var(--ops-muted)]">
          Errores IA, integraciones, API y calidad de turnos visitante. Estadísticas desde D1
          (sin tail manual).
        </p>
        {error ? (
          <p className="mt-4 text-[oklch(0.45_0.15_25)]" role="alert">
            {error}
          </p>
        ) : null}
        {!overview && !error ? (
          <p className="mt-8 text-[var(--ops-muted)]">Cargando…</p>
        ) : null}
        {overview ? (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                label="Errores (24 h)"
                value={String(overview.signals24h.error)}
                hint={`Avisos: ${overview.signals24h.warn}`}
              />
              <Card
                label="Errores (7 d)"
                value={String(overview.signals7d.error)}
                hint={`Avisos: ${overview.signals7d.warn}`}
              />
              <Card
                label="Margen bruto est. (mes)"
                value={`${overview.economics.estimatedGrossMarginPct}%`}
                hint={`$${overview.economics.estimatedGrossUsdMonth.toFixed(0)} USD`}
              />
              <Card
                label="Coste total est. (mes)"
                value={`$${overview.economics.totalEstimatedCostUsdMonth.toFixed(0)}`}
                hint={`MRR $${overview.economics.mrrUsd.toFixed(0)}`}
              />
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-2">
              <QualityPanel title="Turnos visitante (24 h)" q={overview.turnQuality24h} />
              <QualityPanel title="Turnos visitante (7 d)" q={overview.turnQuality7d} />
            </section>

            <section className="mt-10 rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-5">
              <h2 className="font-medium">Economía (mes en curso)</h2>
              <ul className="mt-3 grid gap-2 text-[var(--ops-muted)] sm:grid-cols-2">
                <li>
                  Variable IA (banda ${overview.economics.costBandUsdPer1kCredits}/1k créditos):{" "}
                  <strong className="text-[var(--ops-ink)]">
                    ${overview.economics.estimatedVariableCostUsd.toFixed(2)}
                  </strong>
                </li>
                <li>
                  Infra fija planificada:{" "}
                  <strong className="text-[var(--ops-ink)]">
                    ${overview.economics.fixedInfraUsdMonth.toFixed(2)}
                  </strong>
                </li>
                <li>
                  Comisiones Creem est.:{" "}
                  <strong className="text-[var(--ops-ink)]">
                    ${overview.economics.creemFeesUsdMonth.toFixed(2)}
                  </strong>
                </li>
                <li>
                  Créditos/msg (media usage_counters):{" "}
                  <strong className="text-[var(--ops-ink)]">
                    {overview.economics.usageCreditsPerMessageMonthMean ?? "—"}
                  </strong>
                </li>
              </ul>
            </section>

            <section className="mt-10 rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">Cloudflare (factura MTD)</h2>
                <button
                  type="button"
                  disabled={cfSyncBusy}
                  className="rounded border border-[var(--ops-border)] px-3 py-1 text-xs disabled:opacity-50"
                  onClick={() => void syncCloudflareBilling()}
                >
                  {cfSyncBusy ? "Sincronizando…" : "Sincronizar ahora"}
                </button>
              </div>
              {overview.reconciliation.cfFetchError === "billing_not_configured" ? (
                <p className="mt-3 text-xs text-[var(--ops-muted)]">
                  Añade <code className="text-[10px]">CF_BILLING_API_TOKEN</code> (Billing Read)
                  y ejecuta <code className="text-[10px]">npm run desk:secrets:prod</code>.
                </p>
              ) : null}
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <li>
                  CF facturado MTD:{" "}
                  <strong>
                    {overview.reconciliation.cloudflareUsdMtd != null
                      ? `$${overview.reconciliation.cloudflareUsdMtd.toFixed(2)}`
                      : "—"}
                  </strong>
                </li>
                <li>
                  Desk infra est. (var+fijo):{" "}
                  <strong>
                    ${overview.reconciliation.deskInfraEstimatedUsdMtd.toFixed(2)}
                  </strong>
                </li>
                <li>
                  Δ infra (CF − est.):{" "}
                  <strong>
                    {overview.reconciliation.deltaInfraUsd != null
                      ? `$${overview.reconciliation.deltaInfraUsd.toFixed(2)} (${overview.reconciliation.deltaInfraPct ?? "—"}%)`
                      : "—"}
                  </strong>
                </li>
              </ul>
              {overview.reconciliation.cfFetchedAt ? (
                <p className="mt-2 text-[11px] text-[var(--ops-muted)]">
                  {overview.reconciliation.cfPeriodFrom} → {overview.reconciliation.cfPeriodTo}{" "}
                  · actualizado {overview.reconciliation.cfFetchedAt}
                </p>
              ) : null}
              {overview.reconciliation.cfFetchError &&
              overview.reconciliation.cfFetchError !== "billing_not_configured" ? (
                <p className="mt-2 text-xs text-[oklch(0.45_0.15_25)]" role="alert">
                  {overview.reconciliation.cfFetchError}
                </p>
              ) : null}
              {overview.reconciliation.byFamily.length > 0 ? (
                <ul className="mt-4 space-y-2 text-xs">
                  {overview.reconciliation.byFamily.map((f) => (
                    <li key={f.family}>
                      <span className="font-medium">{f.family}</span> ${f.usd.toFixed(2)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-end gap-3">
                <h2 className="font-medium">Señales recientes</h2>
                <label className="text-xs text-[var(--ops-muted)]">
                  Ventana (h)
                  <select
                    className="ml-2 rounded border border-[var(--ops-border)] px-2 py-1"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  >
                    {[6, 24, 48, 168].map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[var(--ops-muted)]">
                  Severidad
                  <select
                    className="ml-2 rounded border border-[var(--ops-border)] px-2 py-1"
                    value={severity}
                    onChange={(e) =>
                      setSeverity(e.target.value as "" | "error" | "warn")
                    }
                  >
                    <option value="error">error</option>
                    <option value="warn">warn</option>
                    <option value="">todas</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded border border-[var(--ops-border)] px-3 py-1 text-xs"
                  onClick={() => void loadEvents()}
                >
                  Actualizar
                </button>
              </div>
              {overview.signals24h.byCategory.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ops-muted)]">
                  {overview.signals24h.byCategory.map((c) => (
                    <li
                      key={c.category}
                      className="rounded-full border border-[var(--ops-border)] px-2 py-0.5"
                    >
                      {c.category}: {c.error}e / {c.warn}w
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-4 divide-y divide-[var(--ops-border)] rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white">
                {events.length === 0 ? (
                  <li className="p-4 text-[var(--ops-muted)]">Sin señales en este filtro.</li>
                ) : (
                  events.map((ev) => (
                    <li key={ev.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={
                            ev.severity === "error"
                              ? "font-medium text-[oklch(0.45_0.15_25)]"
                              : "text-[var(--ops-muted)]"
                          }
                        >
                          {ev.severity}
                        </span>
                        <span className="text-[var(--ops-muted)]">{ev.created_at}</span>
                        <span className="font-mono">{ev.category}/{ev.code}</span>
                        {ev.org_slug ? (
                          <Link
                            href={`/orgs/${ev.org_id}`}
                            className="text-[var(--ops-ink)] underline"
                          >
                            {ev.org_slug}
                          </Link>
                        ) : null}
                        {ev.request_id ? (
                          <span className="font-mono text-[10px] text-[var(--ops-muted)]">
                            req {ev.request_id.slice(0, 8)}…
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1">{ev.summary}</p>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        ) : null}
      </main>
    </OpsShell>
  );
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-4">
      <p className="text-xs text-[var(--ops-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--ops-muted)]">{hint}</p> : null}
    </div>
  );
}

function QualityPanel({ title, q }: { title: string; q: TurnQuality }) {
  return (
    <div className="rounded-[var(--ops-radius)] border border-[var(--ops-border)] bg-white p-5">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-xs text-[var(--ops-muted)]">
        Muestras: {q.sampleSize.toLocaleString("es")}
        {q.degradedRatePct != null ? ` · Degradados: ${q.degradedRatePct}%` : ""}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Stat label="Créditos/msg p50" value={fmtNum(q.creditsPerMessage.p50)} />
        <Stat label="Créditos/msg p95" value={fmtNum(q.creditsPerMessage.p95)} />
        <Stat label="Media créditos" value={fmtNum(q.creditsPerMessage.mean)} />
        <Stat label="Latencia p50 (ms)" value={fmtNum(q.durationMs.p50)} />
        <Stat label="Latencia p95 (ms)" value={fmtNum(q.durationMs.p95)} />
        <Stat label="Media latencia" value={fmtNum(q.durationMs.mean)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--ops-muted)]">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function fmtNum(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n * 10) / 10 >= 1000
    ? Math.round(n).toLocaleString("es")
    : String(Math.round(n * 10) / 10);
}
