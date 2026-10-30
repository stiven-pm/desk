import Link from "next/link";

export type MarketingHeroStat = { value: string; label: string };

function HeroStats({
  stats,
  compact,
}: {
  stats: MarketingHeroStat[];
  compact?: boolean;
}) {
  return (
    <dl
      className={`grid gap-4 ${
        compact ? "mt-6 grid-cols-2" : "mt-8 sm:grid-cols-2 lg:grid-cols-4"
      }`}
    >
      {stats.map((s) => (
        <div key={s.label}>
          <dt className={`font-display ${compact ? "text-xl" : "text-2xl"}`}>
            {s.value}
          </dt>
          <dd
            className={`mt-0.5 text-[var(--desk-muted)] ${
              compact ? "text-xs leading-snug" : "text-sm"
            }`}
          >
            {s.label}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Inicio: `aside` = mockup de chat (stats bajo el copy, columna derecha visual).
 * Plataforma / precios: sin `aside` (hero más corto, stats en una sola columna).
 */
export function MarketingHero({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  stats,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  stats?: MarketingHeroStat[];
  aside?: React.ReactNode;
}) {
  const withVisual = Boolean(aside);

  return (
    <section className="desk-grain border-b border-[var(--desk-border)] bg-[var(--desk-black)] text-[var(--desk-white)]">
      <div
        className={`mx-auto max-w-6xl px-6 py-10 md:py-11 ${
          withVisual
            ? "grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-start md:gap-8 lg:grid-cols-[1.1fr_0.9fr]"
            : "max-w-3xl"
        }`}
      >
        <div className={withVisual ? "" : "max-w-3xl"}>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--desk-muted)] md:text-sm">
            {eyebrow}
          </p>
          <h1
            className={`mt-2 font-display leading-tight ${
              withVisual
                ? "max-w-xl text-[1.75rem] md:text-[2rem]"
                : "text-[1.85rem] md:text-[2.35rem]"
            }`}
          >
            {title}
          </h1>
          <p
            className={`max-w-xl leading-relaxed text-[var(--desk-muted)] ${
              withVisual ? "mt-3 text-[0.95rem]" : "mt-4 text-base"
            }`}
          >
            {description}
          </p>
          <div className={`flex flex-wrap gap-3 ${withVisual ? "mt-5" : "mt-6"}`}>
            <Link
              href={primaryHref}
              className="rounded-[var(--radius-sm)] bg-[var(--desk-white)] px-4 py-2 text-sm font-medium text-[var(--desk-ink)] hover:bg-white/90"
            >
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link
                href={secondaryHref}
                className="rounded-[var(--radius-sm)] border border-[var(--desk-border)] px-4 py-2 text-sm font-medium text-[var(--desk-white)] hover:bg-[var(--desk-surface)]"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
          {stats && stats.length > 0 && withVisual && (
            <HeroStats stats={stats} compact />
          )}
        </div>

        {aside && <div className="w-full md:max-w-[22rem] md:justify-self-end">{aside}</div>}

        {stats && stats.length > 0 && !withVisual && <HeroStats stats={stats} />}
      </div>
    </section>
  );
}
