import type { PlanFeatureRow } from "@/content/platform";

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="text-[var(--accent)]" aria-label="Incluido">
        ✓
      </span>
    );
  }
  if (value === false) {
    return <span className="text-[var(--muted)]" aria-label="No incluido">—</span>;
  }
  return <span>{value}</span>;
}

export function PlanFeatureTable({ rows }: { rows: PlanFeatureRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted-bg)]/80">
            <th className="px-4 py-3 font-medium">Capacidad</th>
            <th className="px-4 py-3 font-medium">Starter</th>
            <th className="px-4 py-3 font-medium text-[var(--accent)]">Growth</th>
            <th className="px-4 py-3 font-medium">Business</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[var(--border)] last:border-0">
              <td className="px-4 py-3 text-[var(--muted)]">{row.label}</td>
              <td className="px-4 py-3 tabular-nums">
                <Cell value={row.starter} />
              </td>
              <td className="px-4 py-3 tabular-nums bg-[var(--accent)]/[0.04]">
                <Cell value={row.growth} />
              </td>
              <td className="px-4 py-3 tabular-nums">
                <Cell value={row.business} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
