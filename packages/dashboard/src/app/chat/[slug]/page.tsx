"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  HostedPublicChat,
  type CheckoutReturnParams,
  type PublicChatBootstrap,
} from "@/components/hosted-public-chat";
import { resolvePublicApiUrl } from "@/lib/config";

function HostedChatPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug ?? "").trim();
  const embed = searchParams.get("embed") === "1";
  const [checkoutReturn, setCheckoutReturn] = useState<CheckoutReturnParams | null>(
    null,
  );
  const [bootstrap, setBootstrap] = useState<PublicChatBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const readCheckoutReturn = (sp: URLSearchParams): CheckoutReturnParams | null => {
      if (sp.get("checkout_return") !== "1") return null;
      const orderToken = sp.get("order")?.trim();
      if (!orderToken) return null;
      return {
        orderToken,
        checkoutStatus: sp.get("checkout_status")?.trim() || "awaiting_payment",
        publicRef: sp.get("public_ref"),
        summary: sp.get("summary"),
        paymentId: sp.get("paymentId"),
        providerTransactionId: sp.get("id"),
      };
    };
    setCheckoutReturn(readCheckoutReturn(new URLSearchParams(window.location.search)));
  }, [searchParams]);

  useEffect(() => {
    if (!slug) {
      setError("Enlace no válido.");
      return;
    }
    let base: string;
    try {
      base = resolvePublicApiUrl();
    } catch {
      setError("Configuración incompleta del sitio.");
      return;
    }
    void fetch(`${base}/v1/public/chat/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "not_found");
        }
        setBootstrap(data as PublicChatBootstrap);
      })
      .catch(() => setError("Esta tienda no está disponible o el enlace expiró."));
  }, [slug]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm text-[#68737d]">
        {error}
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center text-sm text-[#68737d]">
        Cargando chat…
      </main>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden">
      <HostedPublicChat
        bootstrap={bootstrap}
        embed={embed}
        checkoutReturn={checkoutReturn}
      />
    </div>
  );
}

export default function HostedChatPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
          Cargando chat…
        </main>
      }
    >
      <HostedChatPageInner />
    </Suspense>
  );
}
