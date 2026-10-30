/** Mock del panel Desk — ilustrativo, escala de grises. */
export function ProductPanelPreview() {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[0_8px_30px_oklch(0.2_0.02_55/0.08)]"
      aria-label="Vista ilustrativa del panel de configuración"
    >
      <div className="flex border-b border-[var(--border)] bg-[var(--muted-bg)] text-xs">
        <span className="border-r border-[var(--border)] px-3 py-2 font-medium text-[var(--foreground)]">
          Asistentes
        </span>
        <span className="border-r border-[var(--border)] px-3 py-2 text-[var(--muted)]">
          Documentos
        </span>
        <span className="border-r border-[var(--border)] px-3 py-2 font-medium text-[var(--foreground)]">
          Instrucciones
        </span>
        <span className="px-3 py-2 text-[var(--muted)]">Fuentes</span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-[var(--border)] p-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Archivos indexados
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { name: "politica-devoluciones.pdf", state: "Listo" },
              { name: "catalogo-2026.pdf", state: "Listo" },
              { name: "manual-atencion.docx", state: "Procesando" },
            ].map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-2"
              >
                <span className="truncate text-[var(--foreground)]">{f.name}</span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{f.state}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Instrucciones y tono
          </p>
          <div
            className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted-bg)]/50 p-3 text-xs leading-relaxed text-[var(--muted)]"
          >
            Eres el asistente de Tienda Norte. Responde en español, sé breve. Si no
            encuentras el dato en documentos o sistemas conectados, ofrece pasar con un
            agente. No inventes precios ni plazos.
          </div>
          <p className="mt-3 text-[10px] text-[var(--muted)]">
            Ilustración de diseño — no captura en vivo del panel.
          </p>
        </div>
      </div>
    </div>
  );
}
