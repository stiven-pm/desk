import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_ENTITY } from "@/content/legal/entity";

export const metadata: Metadata = {
  title: "Disponibilidad del servicio | Desk",
};

export default function DisponibilidadPage() {
  const e = LEGAL_ENTITY;
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
        <h1 className="font-display text-3xl">Disponibilidad del servicio</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {e.lastUpdatedEs} · {e.legalName} · NIT {e.taxId} ·{" "}
          <Link href="/legal" className="underline">
            Centro legal
          </Link>
        </p>
        <div className="mt-10 space-y-8 text-[var(--muted)]">
          <section>
            <h2 className="font-display text-xl text-[var(--foreground)]">Planes Starter, Growth y Business</h2>
            <p className="mt-3">
              {e.productName} se presta en régimen de <strong>best effort</strong> (esfuerzos comercialmente
              razonables). No garantizamos disponibilidad ininterrumpida ni tiempos de respuesta de soporte
              contractuales en planes self-serve.
            </p>
            <p className="mt-3">
              La plataforma corre sobre <strong>Cloudflare</strong> (Workers, Durable Objects, D1, R2, Workers AI,
              Vectorize y red edge). Interrupciones, degradaciones o límites de ese proveedor afectan el Servicio aunque
              actuemos con diligencia. También pueden aplicar mantenimiento nuestro o causas fuera de nuestro control.
            </p>
            <p className="mt-3">
              Detalle legal: sección 1 de los{" "}
              <Link href="/terminos" className="underline">
                Términos de servicio
              </Link>
              .
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-[var(--foreground)]">
              Créditos de compensación (wallet)
            </h2>
            <p className="mt-3">
              En planes self-serve <strong>no</strong> hay créditos de servicio automáticos por minuto de caída. Si un
              incidente atribuible a {e.legalName} te impactó de forma relevante, podemos abonar{" "}
              <strong>créditos de wallet</strong> según criterio propio (gravedad, duración, uso del plan e historial).
              Escríbenos a{" "}
              <a href={`mailto:${e.contactEmail}`} className="underline">
                {e.contactEmail}
              </a>
              . Reglas fijas de compensación solo en contrato enterprise.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-[var(--foreground)]">Enterprise</h2>
            <p className="mt-3">
              Si necesitas un <strong>SLA</strong> (porcentaje de uptime, ventanas de mantenimiento, créditos de
              servicio o soporte prioritario), se negocia por escrito aparte de los términos estándar. Escríbenos a{" "}
              <a href={`mailto:${e.contactEmail}`} className="underline">
                {e.contactEmail}
              </a>
              .
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-[var(--foreground)]">Incidentes de seguridad</h2>
            <p className="mt-3">
              Vulnerabilidades e incidentes que afecten datos personales:{" "}
              <a href={`mailto:${e.securityEmail}`} className="underline">
                {e.securityEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </MarketingShell>
  );
}
