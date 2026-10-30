/** Capability strip — sources Desk can use for answers. */
const sources = [
  "Documentos y políticas",
  "Pedidos e inventario",
  "CRM y tickets",
  "Catálogo y precios publicados",
  "ERP, tienda y hojas de cálculo",
];

export function ConnectionsPreview() {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-[0_1px_0_oklch(0.2_0.02_55/0.06)]"
      aria-label="Fuentes de información"
    >
      <p className="text-sm font-medium text-[var(--foreground)]">
        Fuentes de verdad que puedes conectar
      </p>
      <ul className="mt-4 space-y-2">
        {sources.map((name) => (
          <li
            key={name}
            className="flex items-center justify-between gap-3 text-sm text-[var(--foreground)]"
          >
            <span>{name}</span>
            <span className="text-[var(--desk-ink)]" aria-hidden>✓</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
