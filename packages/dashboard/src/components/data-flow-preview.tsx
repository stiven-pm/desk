import { liveDataFlow } from "@/content/marketing";

export function DataFlowPreview() {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 md:p-6"
      aria-label="Flujo ilustrativo de consulta en tiempo real"
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {liveDataFlow.map((step, i) => (
          <li key={step.label} className="relative">
            {i < liveDataFlow.length - 1 && (
              <span
                className="absolute right-0 top-6 hidden h-px w-4 translate-x-full bg-[var(--border)] md:block"
                aria-hidden
              />
            )}
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {step.label}
            </p>
            <p className="mt-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted-bg)]/40 px-3 py-2.5 text-sm text-[var(--foreground)]">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Sin integración: catálogo en Desk + PDFs/FAQ. Con HTTP o MCP: consultas a tu sistema. No incluye
        rastreo de envíos tipo courier salvo que tú lo conectes. Ejemplo ilustrativo.
      </p>
    </div>
  );
}
