import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_ENTITY } from "@/content/legal/entity";

export const metadata: Metadata = {
  title: "Cookie Notice | Desk",
};

export default function CookiesPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
        <h1 className="font-display text-3xl">Cookie Notice</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {LEGAL_ENTITY.lastUpdatedEn} ·{" "}
          <Link href="/privacidad" className="underline">Español (privacidad)</Link>
        </p>
        <div className="mt-10 space-y-6 text-[var(--muted)]">
          <p>
            We use cookies and similar technologies on {LEGAL_ENTITY.siteUrl} and the authenticated dashboard to
            keep you signed in, remember preferences, measure product usage, and protect against abuse.
          </p>
          <h2 className="font-display text-xl text-[var(--foreground)]">Types</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Strictly necessary:</strong> session and security tokens required to operate the Service.
            </li>
            <li>
              <strong>Functional:</strong> language or UI preferences where enabled.
            </li>
            <li>
              <strong>Analytics:</strong> aggregated usage to improve performance (only if enabled).
            </li>
          </ul>
          <p>
            You can control cookies through your browser settings. Blocking necessary cookies may prevent login.
            For EEA/UK visitors, non-essential cookies are used only with consent where required by law.
          </p>
          <p>
            See our <Link href="/privacy" className="underline">Privacy Policy</Link>. Questions:{" "}
            <a href={`mailto:${LEGAL_ENTITY.privacyEmail}`} className="underline">
              {LEGAL_ENTITY.privacyEmail}
            </a>
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
