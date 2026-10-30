"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fetchPrimaryBot } from "@/lib/primary-bot";
import {
  hasKnowledgeForAssistant,
  hasPersonalityInstructions,
} from "@/lib/setup-checklist-logic";

type ChecklistStep = { done: boolean; label: string; href: string };

async function loadChecklistSteps(): Promise<ChecklistStep[]> {
  const [me, bot] = await Promise.all([
    api<{ org: { status: string } }>("/v1/admin/me"),
    fetchPrimaryBot(),
  ]);
  const botId = bot?.id ?? null;

  const [botDetail, docsRes, products, deskRes] = await Promise.all([
    botId
      ? api<{ bot: { systemPrompt: string } }>(`/v1/admin/bots/${botId}`).catch(
          () => ({ bot: { systemPrompt: "" } }),
        )
      : Promise.resolve({ bot: { systemPrompt: "" } }),
    botId
      ? api<{ documents: Array<{ title: string; status: string }> }>(
          `/v1/admin/documents?botId=${encodeURIComponent(botId)}`,
        ).catch(() => ({ documents: [] }))
      : Promise.resolve({ documents: [] }),
    api<{ products: unknown[] }>("/v1/admin/products").catch(() => ({
      products: [],
    })),
    api<{ integrations: Array<{ status: string; definition: { kind: string } }> }>(
      "/v1/admin/desk-integrations",
    ).catch(() => ({ integrations: [] })),
  ]);

  const docs = docsRes.documents ?? [];
  const productCount = products.products?.length ?? 0;
  const integrations = deskRes.integrations ?? [];
  const paymentGatewayConnected = integrations.some(
    (i) => i.definition?.kind === "payment" && i.status === "connected",
  );

  return [
    {
      done: me.org?.status === "active",
      label: "Plan activo",
      href: "/dashboard/billing",
    },
    {
      done: hasKnowledgeForAssistant(docs, 0),
      label: "Documentos",
      href: "/dashboard/configuracion?tab=ia",
    },
    {
      done: productCount > 0,
      label: "Productos",
      href: "/dashboard/products",
    },
    {
      done: paymentGatewayConnected,
      label: "Pasarela de pago",
      href: "/dashboard/configuracion?tab=integraciones",
    },
    {
      done: hasPersonalityInstructions(botDetail.bot.systemPrompt),
      label: "Instrucciones del asistente",
      href: "/dashboard/configuracion?tab=ia",
    },
  ];
}

export function SetupChecklist({ className = "" }: { className?: string }) {
  const [steps, setSteps] = useState<ChecklistStep[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      setSteps(await loadChecklistSteps());
    } catch {
      setError(true);
      setSteps(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <section
        className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 text-sm ${className}`}
      >
        <p className="text-[var(--muted)]">No se pudo cargar el checklist.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 text-xs text-[var(--primary)] underline"
        >
          Reintentar
        </button>
      </section>
    );
  }

  if (!steps) {
    return (
      <section
        className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)] ${className}`}
      >
        Cargando checklist…
      </section>
    );
  }

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Checklist</h2>
        <span className="text-xs text-[var(--muted)]">
          {doneCount}/{steps.length} listo
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2 text-sm">
            <span
              className={s.done ? "text-green-700" : "text-[var(--muted)]"}
              aria-hidden
            >
              {s.done ? "✓" : "○"}
            </span>
            <Link href={s.href} className="underline-offset-2 hover:underline">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
