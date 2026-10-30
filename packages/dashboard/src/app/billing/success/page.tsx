"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SessionShell } from "@/components/session-shell";
import { api } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";

const STORAGE_KEY = "desk_billing_success_ref";

type SavedRef = { ref: string; savedAt: number };

function saveRef(ref: string) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ref, savedAt: Date.now() } satisfies SavedRef),
    );
  } catch {
    /* ignore */
  }
}

function loadRef(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRef;
    if (!parsed?.ref || Date.now() - (parsed.savedAt || 0) > 2 * 60 * 60 * 1000) {
      return null;
    }
    return parsed.ref;
  } catch {
    return null;
  }
}

function clearRef() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function BillingSuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const urlRef = params.get("ref") ?? params.get("request_id");

  const [ref, setRef] = useState<string | null>(urlRef);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"polling" | "paid" | "pending" | "error">(
    "polling",
  );
  const [message, setMessage] = useState("Confirmando pago con Creem…");

  useEffect(() => {
    if (urlRef) {
      saveRef(urlRef);
      setRef(urlRef);
    } else {
      setRef(loadRef());
    }
    setReady(true);
  }, [urlRef]);

  useEffect(() => {
    if (!ready) return;

    const token = localStorage.getItem("token");
    if (!token) {
      const search =
        window.location.search ||
        (ref ? `?ref=${encodeURIComponent(ref)}` : "");
      router.replace(`/login?next=${encodeURIComponent(`/billing/success${search}`)}`);
      return;
    }

    if (!ref) {
      setStatus("pending");
      setMessage(
        "No encontramos la referencia en la URL. Si ya pagaste, abre el panel: suele activarse en segundos.",
      );
      const t = setTimeout(() => router.replace("/dashboard"), 3000);
      return () => clearTimeout(t);
    }

    let attempts = 0;
    const maxAttempts = 30;
    let cancelled = false;

    const goDashboard = () => {
      clearRef();
      router.replace(safeNextPath(params.get("next"), "/dashboard"));
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await api<{
          status: string;
          org_status: string;
          plan_slug: string;
          payment_kind?: string;
        }>(`/v1/admin/billing/payment-status?ref=${encodeURIComponent(ref)}`, {
          token,
        });

        const wallet = res.payment_kind === "wallet";
        if (res.status === "paid" || (!wallet && res.org_status === "active")) {
          setStatus("paid");
          setMessage(
            wallet
              ? "¡Créditos acreditados! Abriendo facturación…"
              : "¡Listo! Tu organización está activa. Abriendo el panel…",
          );
          setTimeout(() => {
            clearRef();
            router.replace(wallet ? "/dashboard/billing" : safeNextPath(params.get("next"), "/dashboard"));
          }, 800);
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          setStatus("pending");
          setMessage(
            "El pago puede tardar un poco. Si Creem ya lo confirmó, el panel se activará en breve.",
          );
          setTimeout(goDashboard, 2500);
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        attempts++;
        if (attempts >= maxAttempts) {
          setStatus("error");
          setMessage(
            "No pudimos verificar aquí. Si el cargo apareció en Creem, entra al panel o escribe a soporte.",
          );
          setTimeout(goDashboard, 3000);
        } else {
          setTimeout(poll, 2000);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [ready, ref, router, params]);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">
        {status === "paid"
          ? "¡Listo!"
          : status === "pending"
            ? "Casi listo"
            : status === "error"
              ? "Revisa el panel"
              : "Procesando pago"}
      </h1>
      <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>
      {ref && (
        <p className="mt-4 text-xs text-[var(--muted)]">Referencia: {ref}</p>
      )}
      {status !== "polling" && (
        <Link
          href="/dashboard"
          className="mt-8 inline-block text-sm text-[var(--accent)] underline underline-offset-2"
        >
          Ir al panel
        </Link>
      )}
      {status === "polling" && (
        <div
          className="mx-auto mt-8 h-9 w-9 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
          aria-hidden
        />
      )}
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <SessionShell eyebrow="Confirmación de pago">
      <Suspense
        fallback={
          <p className="px-6 py-16 text-center text-sm text-[var(--muted)]">
            Confirmando pago…
          </p>
        }
      >
        <BillingSuccessContent />
      </Suspense>
    </SessionShell>
  );
}
