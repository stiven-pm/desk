import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LegalProse } from "@/components/legal-prose";
import { LEGAL_ENTITY } from "@/content/legal/entity";
import { TermsOfServiceEn, termsNavEn } from "@/content/legal/terms-en";

export const metadata: Metadata = {
  title: "Terms of Service | Desk",
  description: `Terms governing use of Desk operated by ${LEGAL_ENTITY.legalName}.`,
  alternates: { canonical: `${LEGAL_ENTITY.siteUrl}/terms` },
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <LegalProse
        title="Terms of Service"
        lastUpdated={LEGAL_ENTITY.lastUpdatedEn}
        lang="en"
        nav={termsNavEn}
        alternate={{ href: "/terminos", label: "Español" }}
      >
        <TermsOfServiceEn />
      </LegalProse>
    </MarketingShell>
  );
}
