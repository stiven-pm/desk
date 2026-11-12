import Link from "next/link";
import {
  PRICING_CURRENCY_NOTE,
  PRICING_FAQ,
  PRICING_PRODUCT_LINE,
  TEAM_SEATS_LINE,
  TRIAL_MARKETING_LINE,
} from "@chatbot/domain";
import { MarketingShell } from "@/components/marketing-shell";
import { MarketingHero } from "@/components/marketing-hero";
import { PlanCards } from "@/components/plan-cards";
import { PlanFeatureTable } from "@/components/plan-feature-table";
import { ProductPanelPreview } from "@/components/product-panel-preview";
import { FaqAccordion } from "@/components/faq-accordion";
import { planFeatureMatrix } from "@/content/platform";

export default function PricingPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Precios"
        title="Invierte en atención, no en otra licencia por agente."
        description="Tres planes según cuántos clientes atiendes y cuántas personas operan contigo. Mismo producto; distinto techo mensual."
        primaryHref="/register"
        primaryLabel="Empezar gratis"
        secondaryHref="/plataforma"
        secondaryLabel="Por qué Desk"
        footnote={TRIAL_MARKETING_LINE}
      />

      <div className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm text-[var(--muted)]">{PRICING_CURRENCY_NOTE}</p>
        <p className="mt-3 max-w-2xl text-sm">{PRICING_PRODUCT_LINE}</p>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{TEAM_SEATS_LINE}</p>

        <div className="mt-10">
          <PlanCards />
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl">Comparativa por plan</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Números para decidir sin llamar a ventas: equipo, volumen, historial, conexiones.
          </p>
          <div className="mt-8">
            <PlanFeatureTable rows={planFeatureMatrix} />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl">Así se ve el panel</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Configuración › IA y bandeja humana — mismos componentes que en producción.
          </p>
          <div className="mt-8">
            <ProductPanelPreview />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-xl">Preguntas frecuentes</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Pagos, créditos, topes, reembolsos, IA y cancelación:{" "}
            <Link href="/preguntas" className="underline underline-offset-2">
              /preguntas
            </Link>
          </p>
          <div className="mt-6">
            <FaqAccordion items={PRICING_FAQ} />
          </div>
        </section>

        <section className="mt-16 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 text-sm">
          <h2 className="font-display text-lg">¿Más volumen o varias marcas?</h2>
          <p className="mt-2 leading-relaxed text-[var(--muted)]">
            Business cubre equipos grandes y muchas conversaciones. Si necesitas contrato anual,
            SLAs o despliegue a medida, escríbenos:{" "}
            <a href="mailto:contact@rekov.co" className="underline">
              contact@rekov.co
            </a>
          </p>
          <Link href="/plataforma" className="mt-4 inline-block underline underline-offset-2">
            Módulos y capacidades de la plataforma
          </Link>
        </section>
      </div>
    </MarketingShell>
  );
}
