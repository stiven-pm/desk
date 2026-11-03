"use client";

import { KnowledgeFileSlot } from "@/components/knowledge-file-slot";
import { MarketingDashboardChrome } from "@/components/marketing-dashboard-chrome";

const DEMO_SLOTS: {
  title: string;
  hint: string;
  fileName: string | null;
  status: "ready" | "indexing" | "empty";
}[] = [
  {
    title: "Catálogo",
    hint: "PDF con productos y precios para que el asistente responda y venda.",
    fileName: "catalogo-2026.pdf",
    status: "ready",
  },
  {
    title: "Políticas",
    hint: "Devoluciones, garantía, envíos.",
    fileName: "politica-devoluciones.pdf",
    status: "ready",
  },
  {
    title: "Preguntas frecuentes",
    hint: "Horarios, pagos, tiempos de entrega.",
    fileName: null,
    status: "empty",
  },
];

/** Vista estática del panel real: Configuración › IA (mismos componentes que en producto). */
export function ProductPanelPreview() {
  return (
    <MarketingDashboardChrome configTab="ia">
      <div className="space-y-3" aria-label="Vista del panel — Configuración, pestaña IA">
        {DEMO_SLOTS.map((slot) => (
          <div
            key={slot.title}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3"
          >
            <p className="text-sm font-medium">{slot.title}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{slot.hint}</p>
            <KnowledgeFileSlot
              accept=".pdf,.doc,.docx,.txt,.md"
              disabled
              fileName={slot.fileName}
              status={slot.status}
              onFile={() => {}}
            />
          </div>
        ))}

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3">
          <p className="text-sm font-medium">Personalidad e instrucciones</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Archivo .txt o .md</p>
          <KnowledgeFileSlot
            accept=".txt,.md"
            disabled
            fileName="instrucciones.md"
            status="ready"
            onFile={() => {}}
          />
        </div>
      </div>
    </MarketingDashboardChrome>
  );
}
