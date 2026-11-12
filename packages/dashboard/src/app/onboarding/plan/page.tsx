"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PLAN_MARKETING, type PaidPlanSlug } from "@chatbot/domain";
import { CheckoutRedirect } from "@/components/checkout-redirect";
import { PlanCards } from "@/components/plan-cards";
import { SessionShell } from "@/components/session-shell";
import { redirectToBillingCheckout } from "@/lib/billing-checkout";

function planLabel(slug: PaidPlanSlug): string {
  return PLAN_MARKETING.find((p) => p.slug === slug)?.name ?? slug;
}

function OnboardingPlanContent() {
  const router = useRouter();
  const params = useSearchParams();
  const planHint = (params.get("plan") as PaidPlanSlug | null) ?? "starter";
  const autoStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [activePlan, setActivePlan] = useState<PaidPlanSlug | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/onboarding/plan")}`);
      return;
    }
    setAuthReady(true);
  }, [router]);

  async function startCheckout(plan: PaidPlanSlug) {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setActivePlan(plan);
    setRedirecting(true);
    setError(null);
    try {
      const went = await redirectToBillingCheckout(plan);
      if (!went) {
        setRedirecting(false);
        setError("No recibimos la URL de pago. Intenta de nuevo.");
      }
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago");
    }
  }

  useLayoutEffect(() => {
    if (!authReady || autoStarted.current) return;
    if (!["starter", "growth", "business"].includes(planHint)) return;
    autoStarted.current = true;
    setActivePlan(planHint);
    setRedirecting(true);
    void startCheckout(planHint);
  }, [authReady, planHint]);

  if (!authReady || redirecting) {
    return (
      <CheckoutRedirect
        planLabel={activePlan ? planLabel(activePlan) : planLabel(planHint)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Elige tu plan</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Precio fijo en USD. Activa cuando quieras desde facturación en el panel.
      </p>
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8">
        <PlanCards
          compact
          cta="dashboard"
          onSelectPlan={(plan) => {
            void startCheckout(plan);
          }}
        />
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        <Link href="/dashboard" className="underline underline-offset-2">
          Volver al panel
        </Link>
        {error && (
          <>
            {" · "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void startCheckout(planHint)}
            >
              Reintentar pago
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export default function OnboardingPlanPage() {
  return (
    <SessionShell eyebrow="Activar suscripción">
      <Suspense fallback={<CheckoutRedirect />}>
        <OnboardingPlanContent />
      </Suspense>
    </SessionShell>
  );
}
