import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { MarketingHero } from "@/components/marketing-hero";
import { PlanFeatureTable } from "@/components/plan-feature-table";
import { ProductPanelPreview } from "@/components/product-panel-preview";
import { DataFlowPreview } from "@/components/data-flow-preview";
import {
  planFeatureMatrix,
  platformBenefits,
  platformModules,
  typicalQuestions,
} from "@/content/platform";
import {
  howDeskWorksSteps,
  MARKETING_TAGLINE,
  plataformaHeroStats,
} from "@/content/marketing";

export default function PlataformaPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Por qué Desk"
        title="Porque tu equipo no debería ser el FAQ humano de tu empresa"
        description="Atiende más clientes en tu chat web con el mismo equipo. Tus datos, tu tono y un precio mensual que puedes defender ante finanzas."
        primaryHref="/register"
        primaryLabel="Quiero esto en mi negocio"
        secondaryHref="/pricing"
        secondaryLabel="Planes y precios"
        stats={plataformaHeroStats}
      />

      <section className="border-b border-[var(--border)] bg-[var(--muted-bg)]/50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{MARKETING_TAGLINE}</p>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl md:text-3xl">Qué cambia en tu operación</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Resultados que notan ventas, soporte y dirección — no un tour del software.
        </p>
        <ol className="mt-10 space-y-6">
          {howDeskWorksSteps.map((s) => (
            <li
              key={s.step}
              className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 md:gap-6"
            >
              <span className="font-display text-2xl text-[var(--muted)]">{s.step}</span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--muted-bg)]/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-2 lg:items-center">
          <ProductPanelPreview />
          <div>
            <h2 className="font-display text-2xl">Tu política comercial, siempre bien dicho</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Devoluciones, garantías y condiciones dejan de variar según quién conteste.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl">Del catálogo al pago (o a tu bandeja) en el mismo chat</h2>
        <div className="mt-8">
          <DataFlowPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl md:text-3xl">Beneficios para tu operación</h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {platformBenefits.map((b) => (
            <li
              key={b.title}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h3 className="font-medium">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{b.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-display text-2xl md:text-3xl">Módulos por plan</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Detalle técnico y etiquetas para tu equipo de producto. La venta empieza en el inicio;
            aquí está el mapa completo.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {platformModules.map((m) => (
              <article
                key={m.title}
                className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
              >
                <h3 className="font-medium">{m.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">{m.body}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {m.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full bg-[var(--muted-bg)] px-2.5 py-0.5 text-xs text-[var(--muted)]"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl">Comparativa por plan</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Fuente única de verdad para archivos, conversaciones y retención. Precios en{" "}
          <Link href="/pricing" className="underline underline-offset-2">Precios</Link>.
        </p>
        <div className="mt-8">
          <PlanFeatureTable rows={planFeatureMatrix} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl">Casos que resuelve cada día</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {typicalQuestions.map((q) => (
            <li
              key={q}
              className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--muted)]"
            >
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-8 md:p-10">
          <h2 className="font-display text-2xl md:text-3xl">Menos ruido en soporte. Más ventas cerradas.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
            Elige plan y empieza hoy. En días puedes estar atendiendo en tu chat web con tus reglas.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)]"
            >
              Empezar ahora
            </Link>
            <Link
              href="/"
              className="rounded-[var(--radius-sm)] border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)]"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
