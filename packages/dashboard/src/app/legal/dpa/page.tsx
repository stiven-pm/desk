import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LegalProse } from "@/components/legal-prose";
import { LEGAL_ENTITY } from "@/content/legal/entity";
import { DataProcessingAddendumEs } from "@/content/legal/dpa-es";

export const metadata: Metadata = {
  title: "Anexo de tratamiento de datos (DPA) | Desk",
};

export default function DpaPage() {
  return (
    <MarketingShell>
      <LegalProse title="Anexo de tratamiento de datos (DPA)" lastUpdated={LEGAL_ENTITY.lastUpdatedEs} lang="es">
        <DataProcessingAddendumEs />
      </LegalProse>
    </MarketingShell>
  );
}
