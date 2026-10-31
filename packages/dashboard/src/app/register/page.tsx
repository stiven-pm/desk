"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PLAN_MARKETING, type PlanSlug } from "@chatbot/domain";
import {
  detectBrowserOrgTimezone,
  OrgTimezoneSelect,
} from "@/components/org-timezone-select";
import { CheckoutRedirect } from "@/components/checkout-redirect";
import { MarketingShell } from "@/components/marketing-shell";
import { api } from "@/lib/api";
import { redirectToBillingCheckout } from "@/lib/billing-checkout";
import { publicApi } from "@/lib/public-api";
import { PasswordField } from "@/components/password-field";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = (params.get("plan") as PlanSlug | null) ?? "starter";
  const [signupsOpen, setSignupsOpen] = useState<boolean | null>(null);
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("America/Bogota");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingCheckout, setOpeningCheckout] = useState(false);

  useEffect(() => {
    setTimezone(detectBrowserOrgTimezone());
  }, []);

  useEffect(() => {
    publicApi<{ signupsOpen: boolean }>("/v1/public/meta")
      .then((m) => setSignupsOpen(m.signupsOpen))
      .catch(() => setSignupsOpen(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError("Debes aceptar los términos legales para crear la cuenta.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<{
        token: string;
        org: { id: string; slug: string; status: string };
      }>("/v1/admin/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          orgName: orgName.trim(),
          timezone,
        }),
      });
      localStorage.setItem("token", data.token);
      setOpeningCheckout(true);
      try {
        const went = await redirectToBillingCheckout(plan);
        if (went) return;
      } catch {
        /* fallback: plan picker with session chrome */
      }
      setOpeningCheckout(false);
      router.push(`/onboarding/plan?plan=${encodeURIComponent(plan)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  if (openingCheckout) {
    const label = PLAN_MARKETING.find((p) => p.slug === plan)?.name ?? plan;
    return <CheckoutRedirect planLabel={label} />;
  }

  if (signupsOpen === null) {
    return <p className="text-sm opacity-70">Cargando…</p>;
  }

  if (!signupsOpen) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm">
        <p>
          El registro público está cerrado en este entorno. Tu equipo de ops puede
          crear la empresa desde el panel de operaciones, o escríbenos a{" "}
          <a href="mailto:contact@rekov.co" className="underline">contact@rekov.co</a>.
        </p>
        <Link href="/login" className="mt-4 inline-block text-[var(--primary)] underline">
          Ya tengo cuenta
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <p className="text-sm text-[var(--muted)]">
        Plan sugerido: <strong className="capitalize text-[var(--foreground)]">{plan}</strong>.
        Después crearás la cuenta y en el siguiente paso irás al pago en Creem.
      </p>
      <label className="block text-sm">
        Nombre de la empresa
        <input
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          minLength={2}
          autoComplete="organization"
          disabled={loading}
        />
      </label>
      <label className="block text-sm">
        Zona horaria (métricas y reportes)
        <OrgTimezoneSelect
          value={timezone}
          onChange={setTimezone}
          disabled={loading}
        />
      </label>
      <label className="block text-sm">
        Tu email (admin)
        <input
          type="email"
          className="mt-1 w-full rounded-md border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </label>
      <label className="block text-sm">
        Contraseña (mín. 10 caracteres)
        <PasswordField
          value={password}
          onChange={setPassword}
          className="mt-1 w-full rounded-md border px-3 py-2 pr-16"
          minLength={10}
          autoComplete="new-password"
          disabled={loading}
        />
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          disabled={loading}
        />
        <span>
          Acepto los{" "}
          <Link href="/terminos" className="underline" target="_blank">
            términos
          </Link>
          ,{" "}
          <Link href="/privacidad" className="underline" target="_blank">
            privacidad
          </Link>{" "}
          y{" "}
          <Link href="/legal#ia" className="underline" target="_blank">
            uso de IA
          </Link>{" "}
          de Desk.
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !accepted}
        className="w-full rounded-md bg-[var(--primary)] py-2 text-[var(--primary-foreground)] disabled:opacity-60"
      >
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold">Crear cuenta Desk</h1>
        <p className="mt-2 text-sm opacity-70">
          <Link href="/pricing" className="underline">Cambiar plan</Link>
          {" · "}
          <Link href="/login" className="underline">Entrar</Link>
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm">Cargando…</p>}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </MarketingShell>
  );
}
