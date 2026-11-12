import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LegalProse } from "@/components/legal-prose";
import { LEGAL_ENTITY } from "@/content/legal/entity";
import { TermsOfServiceEs, termsNavEs } from "@/content/legal/terms-es";

export const metadata: Metadata = {
  title: "Términos de servicio | Desk",
  description:
    "Términos Desk: planes, sin reembolsos salvo ley, cancelación, arbitraje Colombia, integraciones y responsabilidad — Rekov Systems S.A.S.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <MarketingShell>
      <LegalProse
        title="Términos de servicio"
        lastUpdated={LEGAL_ENTITY.lastUpdatedEs}
        lang="es"
        nav={termsNavEs}
        alternate={{ href: "/terms", label: "English" }}
      >
        <TermsOfServiceEs />
      </LegalProse>
    </MarketingShell>
  );
}
