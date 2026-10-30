import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LegalProse } from "@/components/legal-prose";
import { LEGAL_ENTITY } from "@/content/legal/entity";
import { PrivacyPolicyEn, privacyNavEn } from "@/content/legal/privacy-en";

export const metadata: Metadata = {
  title: "Privacy Policy | Desk",
  description: `How ${LEGAL_ENTITY.legalName} collects, uses, and protects personal data for Desk.`,
  alternates: { canonical: `${LEGAL_ENTITY.siteUrl}/privacy` },
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <LegalProse
        title="Privacy Policy"
        lastUpdated={LEGAL_ENTITY.lastUpdatedEn}
        lang="en"
        nav={privacyNavEn}
        alternate={{ href: "/privacidad", label: "Español" }}
      >
        <PrivacyPolicyEn />
      </LegalProse>
    </MarketingShell>
  );
}
