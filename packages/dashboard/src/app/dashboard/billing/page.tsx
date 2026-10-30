"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PLAN_MARKETING,
  WALLET_CREDIT_PACKS,
  type PlanSlug,
  type WalletPackId,
} from "@chatbot/domain";
import { api } from "@/lib/api";
import { redirectToBillingCheckout } from "@/lib/billing-checkout";

type Me = {
  org: { plan_slug: string; status: string };
  usage: { messagesCount: number; aiCreditsUsed: number };
  meteredCredits?: number;
  walletBalance: number;
  limits: { monthlyMessages: number; monthlyAiCredits: number; maxSeats: number };
  seats: { used: number; max: number };
};

function pct(used: number, max: number) {
  if (!max) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export default function BillingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<WalletPackId | null>(null);
  const [planPreview, setPlanPreview] = useState<{
    targetPlan: PlanSlug;
    isDowngrade: boolean;
    warnings: string[];
    limits: Array<{
      label: string;
      current: number;
      target: number;
    }>;
    effectiveNote: string;
    billingNote: string | null;
  } | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    api<Me>("/v1/admin/me", { token })
      .then(setMe)
      .catch(() => setError("No pudimos cargar facturación."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upgrade(plan: PlanSlug) {
    setError(null);
    const ok = await redirectToBillingCheckout(plan);
    if (!ok) setError("No se pudo abrir el checkout. Revisa la configuración de pago.");
  }

  async function startPlanChange(plan: PlanSlug) {
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const preview = await api<{
        isDowngrade: boolean;
        warnings: string[];
        limits: Array<{ label: string; current: number; target: number }>;
        effectiveNote: string;
        billingNote: string | null;
      }>(`/v1/admin/billing/plan-change-preview?targetPlan=${plan}`, { token });
      if (preview.isDowngrade || preview.warnings.length > 0) {
        setPlanPreview({
          targetPlan: plan,
          ...preview,
        });
        return;
      }
      await upgrade(plan);
    } catch {
      setError("No pudimos validar el cambio de plan.");
    }
  }

  async function buyPack(pack: WalletPackId) {
    setError(null);
    setLoadingPack(pack);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const data = await api<{ url?: string }>("/v1/admin/billing/wallet/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ pack }),
      });
      if (data.url) window.location.href = data.url;
      else setError("Checkout no disponible. Contacta a soporte.");
    } catch {
      setError("No pudimos iniciar la recarga de créditos.");
    } finally {
      setLoadingPack(null);
    }
  }

  if (!me) {
    return <p className="p-6 text-sm text-[var(--muted)]">Cargando facturación…</p>;
  }

  const planSlug = me.org.plan_slug as PlanSlug;
  const planMeta = PLAN_MARKETING.find((p) => p.slug === planSlug);
  const metered =
    me.meteredCredits ??
    me.usage.aiCreditsUsed;
  const creditsPct = pct(metered, me.limits.monthlyAiCredits);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-sm">
      <h1 className="font-display text-2xl">Uso y límites</h1>
      <p className="mt-2 text-[var(--muted)]">
        Plan actual: <strong>{planMeta?.name ?? planSlug}</strong>
        {planMeta ? ` · $${planMeta.priceUsd}/mes` : ""}
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Incluye chat web hosted y los cupos del plan.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      <section className="mt-8 space-y-4">
        <div>
          <div className="flex justify-between text-xs text-[var(--muted)]">
            <span>Mensajes de tus clientes este mes</span>
            <span>{me.usage.messagesCount} / {me.limits.monthlyMessages}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[var(--muted-bg)]">
            <div
              className="h-2 rounded-full bg-[var(--accent)]"
              style={{ width: `${pct(me.usage.messagesCount, me.limits.monthlyMessages)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-[var(--muted)]">
            <span>Créditos de procesamiento (plan)</span>
            <span>{metered.toLocaleString("es")} / {me.limits.monthlyAiCredits.toLocaleString("es")}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[var(--muted-bg)]">
            <div
              className="h-2 rounded-full bg-[var(--primary)]"
              style={{ width: `${creditsPct}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Saldo prepago: <strong>{me.walletBalance.toLocaleString("es")}</strong> créditos
          (se usan cuando agotas el cupo del plan).
        </p>
        <p className="text-xs text-[var(--muted)]">
          Usuarios del panel: {me.seats.used} / {me.seats.max}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Recargar créditos IA</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Pago único vía Creem. No aumenta el tope de conversaciones del mes.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.keys(WALLET_CREDIT_PACKS) as WalletPackId[]).map((id) => {
            const p = WALLET_CREDIT_PACKS[id];
            return (
              <li
                key={id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] p-4"
              >
                <p className="font-medium">${p.usd}</p>
                <p className="text-xs text-[var(--muted)]">{p.label}</p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-md bg-[var(--primary)] px-3 py-2 text-xs text-white disabled:opacity-50"
                  disabled={loadingPack !== null || me.org.status !== "active"}
                  onClick={() => buyPack(id)}
                >
                  {loadingPack === id ? "Abriendo…" : "Comprar"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Cambiar plan</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Mensajes de clientes + créditos de procesamiento por plan. Sin cobro por minuto ni por agente.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PLAN_MARKETING.map((p) => (
            <button
              key={p.slug}
              type="button"
              disabled={p.slug === planSlug}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-xs disabled:opacity-40"
              onClick={() => void startPlanChange(p.slug)}
            >
              {p.name} · ${p.priceUsd}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Los botones de arriba abren el checkout de tu plan. La comparativa detallada
          de límites está en esta misma página y en Facturación.
        </p>
      </section>

      {planPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-labelledby="plan-preview-title"
        >
          <div className="max-w-md rounded-lg bg-[var(--card)] p-5 shadow-lg">
            <h2 id="plan-preview-title" className="font-medium">
              Revisa tu cambio de plan
            </h2>
            <p className="mt-2 text-xs text-[var(--muted)]">{planPreview.effectiveNote}</p>
            {planPreview.billingNote && (
              <p className="mt-2 text-xs text-amber-800">{planPreview.billingNote}</p>
            )}
            <ul className="mt-4 space-y-2 text-xs">
              {planPreview.limits.map((l) => (
                <li key={l.label} className="flex justify-between gap-2">
                  <span>{l.label}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {l.current.toLocaleString("es")} → {l.target.toLocaleString("es")}
                  </span>
                </li>
              ))}
            </ul>
            {planPreview.warnings.length > 0 && (
              <ul className="mt-4 list-disc pl-4 text-xs text-red-700">
                {planPreview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs"
                onClick={() => setPlanPreview(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-[var(--foreground)] px-3 py-2 text-xs text-[var(--background)]"
                onClick={() => {
                  const p = planPreview.targetPlan;
                  setPlanPreview(null);
                  void upgrade(p);
                }}
              >
                Continuar al checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
