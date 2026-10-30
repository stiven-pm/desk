export function FaqAccordion({
  items,
}: {
  items: { q: string; a: string }[];
}) {
  return (
    <div className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4">
          <summary className="cursor-pointer list-none font-medium marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-4">
              {item.q}
              <span
                className="text-[var(--muted)] transition group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
