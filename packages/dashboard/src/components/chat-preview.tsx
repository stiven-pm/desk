/** Ejemplo ilustrativo de chat web Desk. */
export function ChatPreview({ compact = false }: { compact?: boolean }) {
  const text = compact ? "text-[13px]" : "text-[14px]";
  return (
    <div
      className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[0_6px_20px_rgba(17,27,33,0.08)]"
      aria-label="Ejemplo ilustrativo de chat web"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--muted-bg)] text-xs font-semibold">
          TN
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Tu negocio</p>
        </div>
      </div>
      <div className={`space-y-2 bg-[var(--muted-bg)]/40 p-3 leading-snug ${text}`}>
        <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-tr-sm bg-[var(--primary)] px-2.5 py-1.5 text-[var(--primary-foreground)]">
          Hola, ¿qué tienen disponible?
        </div>
        <div className="mr-auto w-fit max-w-[90%] rounded-lg rounded-tl-sm border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
          Estos son algunos artículos del catálogo. Elige uno para armar el pedido.
        </div>
        <div className="mr-auto w-fit max-w-[90%] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2">
          <p className="text-[11px] font-medium text-[var(--muted)]">Productos</p>
          <p className="mt-1 text-[12px]">Plan básico · $20.000</p>
          <p className="text-[12px]">Plan estándar · $35.000</p>
        </div>
        {!compact && (
          <>
            <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-tr-sm bg-[var(--primary)] px-2.5 py-1.5 text-[var(--primary-foreground)]">
              El plan básico, por favor
            </div>
            <div className="mr-auto w-fit max-w-[90%] rounded-lg rounded-tl-sm border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
              Listo. Te envío el enlace para pagar. Si necesitas un asesor, escribe
              &quot;hablar con alguien&quot;.
            </div>
          </>
        )}
        <p className="pt-1 text-center text-[10px] text-[var(--muted)]">
          Ejemplo ilustrativo · chat web
        </p>
      </div>
    </div>
  );
}
