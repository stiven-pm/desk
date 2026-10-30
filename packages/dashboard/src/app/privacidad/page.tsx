import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LegalProse } from "@/components/legal-prose";
import { LEGAL_ENTITY } from "@/content/legal/entity";
import { PrivacyPolicyEs, privacyNavEs } from "@/content/legal/privacy-es";

export const metadata: Metadata = {
  title: "Política de privacidad | Desk",
  description: `Tratamiento de datos personales en Desk por ${LEGAL_ENTITY.legalName}.`,
};

export default function PrivacidadPage() {
  return (
    <MarketingShell>
      <LegalProse
        title="Política de privacidad"
        lastUpdated={LEGAL_ENTITY.lastUpdatedEs}
        lang="es"
        nav={privacyNavEs}
        alternate={{ href: "/privacy", label: "English" }}
      >
        <PrivacyPolicyEs />
      </LegalProse>
    </MarketingShell>
  );
}
