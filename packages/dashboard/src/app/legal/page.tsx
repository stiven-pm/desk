import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_ENTITY } from "@/content/legal/entity";

export default function LegalPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
        <h1 className="font-display text-3xl">Centro legal</h1>
        <p className="mt-4 text-[var(--muted)]">
          Desk es operado por <strong>{LEGAL_ENTITY.legalName}</strong>, {LEGAL_ENTITY.country}. Cobros,
          contratos y responsabilidad del Servicio recaen en esa sociedad. Contacto:{" "}
          <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
            {LEGAL_ENTITY.contactEmail}
          </a>
          .
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Última actualización: {LEGAL_ENTITY.lastUpdatedEs}.
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/privacidad"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] p-5 hover:bg-[var(--muted-bg)]"
          >
            <h2 className="font-display text-lg">Política de privacidad</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Qué datos recogemos, chat web, IA, derechos GDPR y Ley 1581.
            </p>
          </Link>
          <Link
            href="/privacy"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] p-5 hover:bg-[var(--muted-bg)]"
          >
            <h2 className="font-display text-lg">Privacy Policy (EN)</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              URL en inglés: {LEGAL_ENTITY.siteUrl}/privacy
            </p>
          </Link>
          <Link
            href="/terminos"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] p-5 hover:bg-[var(--muted-bg)]"
          >
            <h2 className="font-display text-lg">Términos de servicio</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Uso aceptable, sin reembolsos, arbitraje, propiedad intelectual.
            </p>
          </Link>
          <Link
            href="/terms"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] p-5 hover:bg-[var(--muted-bg)]"
          >
            <h2 className="font-display text-lg">Terms of Service (EN)</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Binding terms for international customers.</p>
          </Link>
          <Link
            href="/legal/cookies"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] p-5 hover:bg-[var(--muted-bg)]"
          >
            <h2 className="font-display text-lg">Cookies</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Sesión, seguridad y analítica.</p>
          </Link>
          <Link
            href="/legal/dmca"
            className="rounded-[var(--radius-sm)] border border-[var(--border)] p-5 hover:bg-[var(--muted-bg)]"
          >
            <h2 className="font-display text-lg">DMCA / copyright</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Avisos de retiro y contranotificación.</p>
          </Link>
        </section>

        <section id="seguridad" className="mt-14">
          <h2 className="font-display text-xl">Seguridad y cumplimiento</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>Tráfico cifrado TLS (HTTPS) entre clientes y nuestro edge.</li>
            <li>Aislamiento lógico multi-tenant por organización; permisos por rol.</li>
            <li>Contraseñas con hash; secretos de integración cifrados en reposo.</li>
            <li>Registros operativos, límites de tasa y monitoreo ante abuso.</li>
            <li>
              Copias de seguridad y recuperación alineadas con nuestro proveedor de nube; notificación de
              incidentes según ley aplicable a{" "}
              <a href={`mailto:${LEGAL_ENTITY.securityEmail}`} className="underline">
                {LEGAL_ENTITY.securityEmail}
              </a>
              .
            </li>
            <li>
              Chat web: el cliente es responsable de avisos de privacidad y consentimiento ante sus visitantes.
            </li>
            <li>
              DPA (anexo de tratamiento B2B) disponible para enterprise en {LEGAL_ENTITY.contactEmail}.
            </li>
          </ul>
        </section>

        <section id="ia" className="mt-12">
          <h2 className="font-display text-xl">Divulgación de IA</h2>
          <p className="mt-3 text-[var(--muted)]">
            Los visitantes de tus canales pueden recibir respuestas generadas por sistemas automatizados. Las salidas
            pueden ser incorrectas. Debes informar a tus usuarios cuando la ley o tu sector lo exijan (incluidas
            directrices de transparencia en EE. UU.). No usamos tus conversaciones para entrenar modelos fundacionales
            públicos.
          </p>
        </section>

        <p className="mt-12 text-xs text-[var(--muted)]">
          Los documentos enlazados forman parte de tu relación contractual con Rekov Systems S.A.S. Si necesitas
          un anexo de tratamiento de datos (B2B), escribe a {LEGAL_ENTITY.contactEmail}.
        </p>
      </article>
    </MarketingShell>
  );
}
