"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  HostedStorefront,
  type StorefrontBootstrap,
} from "@/components/hosted-storefront";
import { resolvePublicApiUrl } from "@/lib/config";

function StorefrontPageInner() {
  const params = useParams();
  const slug = String(params.slug ?? "").trim();
  const [bootstrap, setBootstrap] = useState<StorefrontBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Tienda no encontrada.");
      return;
    }
    let base: string;
    try {
      base = resolvePublicApiUrl();
    } catch {
      setError("Configuración incompleta del sitio.");
      return;
    }
    void fetch(`${base}/v1/public/storefront/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "not_found");
        setBootstrap(data as StorefrontBootstrap);
      })
      .catch(() => setError("Esta tienda no está disponible."));
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
        Cargando tienda…
      </main>
    );
  }

  return <HostedStorefront bootstrap={bootstrap} />;
}

export default function TenantStorefrontPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-6 py-16 text-center text-sm">
          Cargando tienda…
        </main>
      }
    >
      <StorefrontPageInner />
    </Suspense>
  );
}
