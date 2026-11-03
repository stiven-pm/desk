import { MarketingDashboardChrome } from "@/components/marketing-dashboard-chrome";

const ROWS = [
  {
    title: "Política de devoluciones",
    description: "Plazos y condiciones para cambios",
    file: "politica-devoluciones.pdf",
    status: "Listo",
  },
  {
    title: "Catálogo 2026",
    description: "Lista de precios de referencia",
    file: "catalogo-2026.pdf",
    status: "Listo",
  },
  {
    title: "Manual de atención",
    description: "Tono y escalamiento a humano",
    file: "manual-atencion.docx",
    status: "Indexando",
  },
] as const;

/** Misma tabla que `/dashboard/documents` (Conocimiento). */
export function KnowledgeDocumentsPreview() {
  return (
    <MarketingDashboardChrome activeNav="bandeja" showConfigTabs={false}>
      <div aria-label="Vista del panel — Conocimiento">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Conocimiento</h2>
            <p className="mt-1 max-w-md text-xs text-[var(--muted)]">
              PDFs y textos para respuestas con contexto.
            </p>
          </div>
          <span className="rounded-md bg-[var(--primary)] px-3 py-2 text-xs text-[var(--primary-foreground)]">
            Subir documento
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-[var(--muted-bg)]/40 text-xs text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Documento</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ROWS.map((d) => (
                <tr key={d.file} className="hover:bg-[var(--muted-bg)]/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{d.title}</div>
                    <div className="line-clamp-1 text-xs text-[var(--muted)]">{d.description}</div>
                    <div className="text-xs text-[var(--muted)]">{d.file}</div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-[var(--muted)] sm:table-cell">
                    {d.status}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-[var(--muted)]">
                    Editar · Eliminar
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MarketingDashboardChrome>
  );
}
