import { MarketingDashboardChrome } from "@/components/marketing-dashboard-chrome";

const USER_BUBBLE =
  "ml-auto max-w-[90%] w-fit rounded-lg bg-[#edf0f2] px-3 py-2 text-sm text-[#2f3941]";
const ASSISTANT_BUBBLE =
  "mr-auto max-w-[95%] w-fit rounded-lg border border-[#d8dcde] bg-white px-3 py-2 text-sm text-[#2f3941]";

const QUEUE = [
  { label: "Visitante a3f2…", summary: "¿Cuánto tarda la devolución?" },
  { label: "maria@tienda.co", summary: "Pidió un asesor" },
] as const;

/** Misma estructura que `DeskInboxPanel` (bandeja humana). */
export function InboxMarketingPreview({ compact = false }: { compact?: boolean }) {
  return (
    <MarketingDashboardChrome activeNav="bandeja" showConfigTabs={false}>
      <section
        className={`flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white ${
          compact ? "h-[280px]" : "h-[min(420px,70vw)]"
        }`}
        aria-label="Vista del panel — Bandeja"
      >
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(180px,240px)_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-[var(--border)] md:border-b-0 md:border-r">
            <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5 text-sm font-semibold text-[#2f3941]">
              Bandeja
            </div>
            <ul className="min-h-0 flex-1 overflow-hidden">
              {QUEUE.map((item, i) => (
                <li key={item.label}>
                  <div
                    className={[
                      "border-b border-[var(--border)] px-3 py-2.5 text-left text-xs last:border-0",
                      i === 0 ? "bg-[#edf0f2]" : "",
                    ].join(" ")}
                  >
                    <span className="block truncate font-medium">{item.label}</span>
                    <span className="line-clamp-1 text-[var(--muted)]">{item.summary}</span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex min-h-0 flex-col bg-white">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#d8dcde] px-4 py-3">
              <h2 className="min-w-0 truncate text-base font-semibold text-[#2f3941]">
                Visitante a3f2…
              </h2>
              <span className="shrink-0 text-xs text-[#68737d]">Pendiente</span>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
              <div className={USER_BUBBLE}>¿Cuánto tarda la devolución?</div>
              <div className={ASSISTANT_BUBBLE}>
                Según nuestra política, tienes 30 días… ¿Quieres que te pase con un agente?
              </div>
              <div className={USER_BUBBLE}>Sí, por favor</div>
            </div>
            <footer className="shrink-0 border-t border-[#d8dcde] p-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-[#d8dcde] px-2.5 py-2 text-xs text-[#68737d]">
                  Cerrar
                </span>
                <div className="min-w-0 flex-1 rounded-md border border-[#d8dcde] px-3 py-2 text-sm text-[#68737d]">
                  Escribe al cliente…
                </div>
                <span className="rounded-md bg-[#2f3941] px-4 py-2 text-sm font-medium text-white">
                  Enviar
                </span>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </MarketingDashboardChrome>
  );
}
