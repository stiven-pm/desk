import Link from "next/link";
import { PRICING_FAQ } from "@chatbot/domain";
import { MarketingShell } from "@/components/marketing-shell";
import { MarketingHero } from "@/components/marketing-hero";
import { PlanCards } from "@/components/plan-cards";
import { ChatPreview } from "@/components/chat-preview";
import { ProductPanelPreview } from "@/components/product-panel-preview";
import { DataFlowPreview } from "@/components/data-flow-preview";
import { FaqAccordion } from "@/components/faq-accordion";
import {
  homeHeroStats,
  howDeskWorksSteps,
  MARKETING_TAGLINE,
  trustPoints,
  useCases,
} from "@/content/marketing";

export default function LandingPage() {
  const homeFaq = PRICING_FAQ.slice(0, 4);

  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Atención y ventas en tu chat web"
        title="Deja de perder clientes por responder tarde."
        description="Desk responde en tu chat y tienda hosted con tus políticas y los datos de tu negocio, a cualquier hora."
        primaryHref="/register"
        primaryLabel="Empezar ahora"
        secondaryHref="/pricing"
        secondaryLabel="Ver planes"
        stats={homeHeroStats}
        aside={<ChatPreview compact />}
      />

      <section className="border-b border-[var(--border)] bg-[var(--muted-bg)]/50">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
            {MARKETING_TAGLINE}
          </p>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-[var(--muted)] md:text-sm">
            <strong className="font-medium text-[var(--foreground)]">IA y automatización:</strong> Desk usa
            modelos de lenguaje para generar respuestas a partir de tu configuración y tus datos. Pueden existir
            errores; revisa casos sensibles con tu equipo. Operado por Rekov Systems S.A.S. —{" "}
            <Link href="/privacidad" className="underline underline-offset-2">privacidad</Link>
            {" · "}
            <Link href="/terminos" className="underline underline-offset-2">términos</Link>.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl md:text-3xl">Donde más te duele hoy</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Quitar carga real de ventas y soporte en el chat web.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {useCases.map((c) => (
            <li
              key={c.title}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h3 className="font-medium">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--muted-bg)]/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--muted)]">02</p>
            <h2 className="mt-2 font-display text-2xl md:text-3xl">
              Lo que ya sabes de tu negocio, al instante para el cliente
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Políticas, precios y reglas dejan de depender de quién esté conectado ese día.
            </p>
            <Link href="/register" className="mt-4 inline-block text-sm font-medium underline underline-offset-2">
              Probar con mi empresa
            </Link>
          </div>
          <ProductPanelPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--muted)]">03</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl">
          Catálogo, documentos y — si lo conectas — tu tienda o ERP
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          La IA responde con lo que subes al panel y lo que expongas por integración; si no hay dato, escala a tu
          bandeja en el mismo chat.
        </p>
        <div className="mt-8">
          <DataFlowPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl">Lo que compras</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {howDeskWorksSteps.map((s) => (
            <li
              key={s.step}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <span className="text-xs font-medium text-[var(--muted)]">{s.step}</span>
              <h3 className="mt-1 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-display text-2xl">Sin sorpresas para ti ni para finanzas</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {trustPoints.map((t) => (
              <li
                key={t.title}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
              >
                <h3 className="font-medium">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm">
            <Link href="/legal" className="underline underline-offset-2">
              Términos, privacidad, IA y seguridad
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-2xl md:text-3xl">Elige el plan que aguanta tu volumen</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Empieza donde estás hoy; sube cuando crezca el tráfico o el equipo.
        </p>
        <div className="mt-10">
          <PlanCards />
        </div>
        <p className="mt-8 text-sm">
          <Link href="/pricing" className="font-medium underline underline-offset-2">
            Ver todos los planes y objeciones frecuentes
          </Link>
        </p>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
        <div className="mx-auto max-w-3xl px-6 py-14 pb-16">
          <h2 className="font-display text-xl">Preguntas frecuentes</h2>
          <div className="mt-6">
            <FaqAccordion items={homeFaq} />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
