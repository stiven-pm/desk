import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_ENTITY } from "@/content/legal/entity";

export const metadata: Metadata = {
  title: "DMCA / Copyright Policy | Desk",
};

export default function DmcaPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
        <h1 className="font-display text-3xl">Copyright &amp; takedown policy</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {LEGAL_ENTITY.legalName} · Agent: {LEGAL_ENTITY.dmcaEmail}
        </p>
        <div className="mt-10 space-y-6 text-[var(--muted)]">
          <p>
            We respect intellectual property. If you believe material available through Desk infringes your
            copyright, send a notification to our designated agent at{" "}
            <a href={`mailto:${LEGAL_ENTITY.dmcaEmail}`} className="underline">
              {LEGAL_ENTITY.dmcaEmail}
            </a>
            with:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Your physical or electronic signature.</li>
            <li>Identification of the copyrighted work.</li>
            <li>Identification of the material and sufficient information to locate it (URL, org, conversation ID).</li>
            <li>Your contact information.</li>
            <li>
              A statement that you have a good-faith belief the use is not authorized by the owner, its agent, or law.
            </li>
            <li>
              A statement, under penalty of perjury, that the information is accurate and you are authorized to act.
            </li>
          </ol>
          <p>
            We may remove or disable access and notify the Customer who posted the content. Repeat infringers may
            lose access. Counter-notices under 17 U.S.C. § 512 may be sent to the same address with the elements
            required by law.
          </p>
          <p>
            For trademark, defamation, or privacy requests that are not copyright claims, email{" "}
            {LEGAL_ENTITY.contactEmail} with supporting detail.
          </p>
          <p>
            <Link href="/terms#dmca" className="underline">Terms of Service — Copyright section</Link>
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
