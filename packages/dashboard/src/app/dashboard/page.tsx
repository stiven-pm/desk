"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PlanCards } from "@/components/plan-cards";
import { CheckoutRedirect } from "@/components/checkout-redirect";
import { api } from "@/lib/api";
import { redirectToBillingCheckout } from "@/lib/billing-checkout";
import type { PaidPlanSlug } from "@chatbot/domain";
import { orgServiceActive } from "@chatbot/domain";

function DashboardRoot() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get("checkout") as PaidPlanSlug | null;

  const [org, setOrg] = useState<{ status: string; trial_ends_at?: string | null } | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function checkout(plan: PaidPlanSlug) {
    setRedirecting(true);
    setCheckoutError(null);
    const went = await redirectToBillingCheckout(plan);
    if (!went) {
      setRedirecting(false);
      setCheckoutError("No se pudo abrir el pago.");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    api<{ org: { status: string; trial_ends_at?: string | null } }>("/v1/admin/me", { token })
      .then((d) => setOrg(d.org))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!org) return;
    if (orgServiceActive(org.status, org.trial_ends_at ?? null)) {
      router.replace("/dashboard/metrics");
      return;
    }
    if (checkoutParam && ["starter", "growth", "business"].includes(checkoutParam)) {
      setRedirecting(true);
      void redirectToBillingCheckout(checkoutParam as PaidPlanSlug);
    }
  }, [org, checkoutParam, router]);

  if (redirecting) {
    return <CheckoutRedirect />;
  }

  if (!org) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--muted)]">
        Cargando…
      </main>
    );
  }

  if (org && orgServiceActive(org.status, org.trial_ends_at ?? null)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--muted)]">
        Cargando…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl">Activa tu espacio</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
        Elige un plan y completa el pago en Creem. Al confirmarse, tu espacio queda activo al instante. Dudas:{" "}
        <a href="mailto:contact@rekov.co" className="underline underline-offset-2">contact@rekov.co</a>.
      </p>
      {checkoutError && (
        <p className="mt-4 text-sm text-red-600">{checkoutError}</p>
      )}
      <div className="mt-8">
        <PlanCards compact cta="dashboard" onSelectPlan={(p) => void checkout(p)} />
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--muted)]">
          Cargando…
        </main>
      }
    >
      <DashboardRoot />
    </Suspense>
  );
}
