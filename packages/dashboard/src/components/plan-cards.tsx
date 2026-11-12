import Link from "next/link";
import { PLAN_MARKETING, type PaidPlanSlug } from "@chatbot/domain";

export function PlanCards({
  cta = "register",
  compact = false,
  onSelectPlan,
}: {
  cta?: "register" | "dashboard";
  compact?: boolean;
  onSelectPlan?: (plan: PaidPlanSlug) => void;
}) {
  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "gap-4 lg:grid-cols-3"}`}>
      {PLAN_MARKETING.map((plan) => {
        const href =
          cta === "register"
            ? `/register?plan=${plan.slug}`
            : `/dashboard?checkout=${plan.slug}`;
        const featured = plan.slug === "growth";
        const highlights = compact ? plan.highlights.slice(0, 4) : plan.highlights;
        return (
          <article
            key={plan.slug}
            className={`flex flex-col border bg-[var(--card)] ${
              compact ? "p-4" : "p-6"
            } ${
              featured && !compact
                ? "border-[var(--accent)] lg:-mt-2 lg:mb-2 lg:shadow-[0_8px_30px_oklch(0.4_0.08_45/0.12)]"
                : featured
                  ? "border-[var(--accent)]"
                  : "border-[var(--border)]"
            } rounded-[var(--radius-lg)]`}
          >
            {featured && (
              <span className="mb-2 text-xs font-medium text-[var(--accent)]">
                Más elegido
              </span>
            )}
            <h3 className={compact ? "text-lg font-semibold" : "font-display text-2xl"}>
              {plan.name}
            </h3>
            <p
              className={`font-sans font-semibold tabular-nums tracking-tight ${
                compact ? "mt-1 text-2xl" : "mt-2 text-3xl"
              }`}
            >
              ${plan.priceUsd}
              <span className="text-sm font-normal text-[var(--muted)]"> USD/mes</span>
            </p>
            <p
              className={`text-[var(--muted)] ${compact ? "mt-2 text-xs leading-snug" : "mt-3 text-sm leading-relaxed"}`}
            >
              {plan.tagline}
            </p>
            {!compact && (
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">Ideal para: </span>
                {plan.forWho}
              </p>
            )}
            <ul
              className={`flex-1 space-y-1.5 border-t border-[var(--border)] text-sm ${
                compact ? "mt-3 pt-3" : "mt-5 pt-5 space-y-2"
              }`}
            >
              {highlights.map((h) => (
                <li key={h} className="flex gap-2 text-xs sm:text-sm">
                  <span className="text-[var(--accent)]" aria-hidden>—</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            {!compact && (
              <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-[var(--muted)]">
                {plan.overageNote}
              </p>
            )}
            {onSelectPlan ? (
              <button
                type="button"
                onClick={() => onSelectPlan(plan.slug as PaidPlanSlug)}
                className={`w-full rounded-[var(--radius-sm)] text-sm font-medium ${
                  compact ? "mt-4 py-2" : "mt-6 py-2.5"
                } ${
                  featured
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border border-[var(--border)] hover:bg-[var(--muted-bg)]"
                }`}
              >
                Elegir {plan.name}
              </button>
            ) : (
              <Link
                href={href}
                className={`block w-full rounded-[var(--radius-sm)] text-center text-sm font-medium ${
                  compact ? "mt-4 py-2" : "mt-6 py-2.5"
                } ${
                  featured
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border border-[var(--border)] hover:bg-[var(--muted-bg)]"
                }`}
              >
                {cta === "register" ? "Comenzar" : "Suscribirse"}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
