import { LEGAL_ENTITY } from "./entity";

export const termsNavEn = [
  { href: "#service", label: "Service" },
  { href: "#accounts", label: "Accounts" },
  { href: "#acceptable", label: "Acceptable use" },
  { href: "#billing", label: "Billing & refunds" },
  { href: "#ip", label: "IP & content" },
  { href: "#dmca", label: "Copyright" },
  { href: "#liability", label: "Liability" },
  { href: "#arbitration", label: "Disputes" },
];

export function TermsOfServiceEn() {
  const e = LEGAL_ENTITY;
  return (
    <>
      <section>
        <p>
          These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and {e.legalName}{" "}
          (&quot;{e.brand}&quot;, &quot;we&quot;, &quot;us&quot;) governing access to {e.productName} at{" "}
          <a href={e.siteUrl}>{e.siteUrl}</a> and related APIs (the &quot;Service&quot;). By registering, signing in
          with acceptance checked, clicking
          accept, or using the Service, you agree to these Terms and our{" "}
          <a href="/privacy">Privacy Policy</a>. If you use the Service on behalf of a company,
          you represent that you have authority to bind that entity.
        </p>
        <p className="mt-3">
          <strong>Who bills and who is liable.</strong> Subscriptions and wallet charges are billed by {e.legalName}{" "}
          through our payment processor in U.S. dollars unless otherwise agreed in writing. {e.legalName} is the
          contracting party responsible for the Service. Customers are responsible for their own taxes, filings, and
          compliance with laws applicable to their business and End Users.
        </p>
      </section>

      <section id="service">
        <h2>1. The Service</h2>
        <p>
          {e.productName} provides multi-tenant software that replies with AI on hosted web chat and storefront,
          using your documents and integrations. We may change features with reasonable notice. The Service is provided on a commercially reasonable efforts basis; we do not
          guarantee uninterrupted availability.
        </p>
        <p className="mt-3">
          <strong>AI replies.</strong> Replies are generated automatically from your configuration, documents,
          and integrations and may contain errors. You are responsible for keeping that information (prices,
          stock, policies) current and for what the AI communicates to your customers on your behalf.
        </p>
      </section>

      <section id="accounts">
        <h2>2. Accounts and security</h2>
        <ul>
          <li>You must provide accurate registration information and keep credentials confidential.</li>
          <li>You control team roles (owner, admin, agent) within your organization.</li>
          <li>You are responsible for activity under your account and for securing API keys and integrations.</li>
          <li>We may suspend accounts for suspected abuse, non-payment, or legal risk.</li>
        </ul>
      </section>

      <section id="acceptable">
        <h2>3. Acceptable use</h2>
        <p>You and your End Users may not:</p>
        <ul>
          <li>Violate law, infringe intellectual property, or harass others.</li>
          <li>Send spam, phishing, or unlawful automated messages.</li>
          <li>Upload malware, illegal content, or material you lack rights to use.</li>
          <li>Probe or circumvent technical limits, security, or metering of the Service.</li>
          <li>Use the Service for high-risk regulated decisions without appropriate human oversight.</li>
        </ul>
        <p className="mt-3">
          We may remove content, throttle, or terminate access with notice when practical, or immediately for
          severe risk.
        </p>
      </section>

      <section id="billing">
        <h2>4. Plans, billing, and refunds</h2>
        <ul>
          <li>
            The Service requires an active paid plan from signup; there is no free trial and no dashboard use
            without a subscription.
          </li>
          <li>
            Paid plans renew monthly until canceled in the billing portal or by written notice where portal access
            is unavailable.
          </li>
          <li>
            <strong>Refund policy:</strong> Except where mandatory consumer law requires otherwise,{" "}
            <strong>all fees are non-refundable</strong>, including partial billing periods, unused message or
            credit quotas, and wallet top-ups. Chargebacks without contacting us first may result in suspension.
          </li>
          <li>Price changes apply to the next renewal after notice to billing contacts.</li>
          <li>Enterprise agreements may supersede this section if signed in writing.</li>
        </ul>
      </section>

      <section id="ip">
        <h2>5. Intellectual property and your content</h2>
        <p>
          You retain ownership of your data, documents, and configurations. You grant {e.legalName} a worldwide,
          non-exclusive license to host, process, transmit, and display your content solely to operate the
          Service. {e.productName}, our trademarks, and documentation remain our property.
        </p>
        <p className="mt-3">
          AI-generated outputs may not be unique; similar outputs may be produced for others. You are responsible
          for reviewing outputs before relying on them commercially or legally.
        </p>
      </section>

      <section id="dmca">
        <h2>6. Copyright complaints (DMCA)</h2>
        <p>
          If you believe content on the Service infringes your copyright, send a notice to our designated agent at{" "}
          <a href={`mailto:${e.dmcaEmail}`}>{e.dmcaEmail}</a> with: (1) identification of the work; (2)
          identification of the material and its location; (3) your contact information; (4) a good-faith statement
          of unauthorized use; (5) a statement under penalty of perjury that your notice is accurate and you are
          authorized to act; (6) your physical or electronic signature. We may remove or disable access and notify
          the poster. Counter-notice procedures follow U.S. DMCA where applicable. See also{" "}
          <a href="/legal/dmca">DMCA policy</a>.
        </p>
        <p className="mt-3">
          For non-copyright takedowns (defamation, privacy, trademark), contact {e.contactEmail} with sufficient
          detail for us to assess the request.
        </p>
      </section>

      <section id="privacy">
        <h2>7. Privacy</h2>
        <p>
          Our <a href="/privacy">Privacy Policy</a> describes data practices. When you process End User personal
          data, you are the controller and we are the processor as described there and in any DPA you execute with
          us.
        </p>
      </section>

      <section id="third">
        <h2>8. Third-party services</h2>
        <p>
          Integrations, payment processors, and Customer-configured APIs are third-party services.
          We are not responsible for their availability, terms, or acts. You use them at your own risk.
        </p>
      </section>

      <section id="liability">
        <h2>9. Disclaimers and limitation of liability</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY
          LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p className="mt-3">
          WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS
          OR DATA. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE IS LIMITED TO THE
          GREATER OF (A) AMOUNTS YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR
          (B) ONE HUNDRED U.S. DOLLARS (USD $100).
        </p>
        <p className="mt-3">
          Some jurisdictions do not allow certain limitations; in those cases our liability is limited to the
          fullest extent permitted.
        </p>
      </section>

      <section id="indemnity">
        <h2>10. Indemnification</h2>
        <p>
          You will defend and indemnify {e.legalName} and its directors, employees, and affiliates against claims
          arising from your content, your use of the Service, your End Users, your integrations, or your violation
          of these Terms or applicable law, except to the extent caused by our gross negligence or willful
          misconduct.
        </p>
      </section>

      <section id="termination">
        <h2>11. Suspension and termination</h2>
        <p>
          Either party may terminate for material breach if not cured within 30 days of notice. We may suspend
          immediately for non-payment, abuse, or legal compulsion. Upon termination, your right to access ends;
          export data before canceling where possible. Sections that by nature should survive (payment owed,
          liability limits, arbitration, IP) survive termination.
        </p>
      </section>

      <section id="arbitration">
        <h2>12. Dispute resolution and arbitration</h2>
        <p>
          <strong>Informal resolution.</strong> Contact {e.contactEmail} first; we will try to resolve disputes
          informally within 30 days.
        </p>
        <p className="mt-3">
          <strong>Binding arbitration.</strong> Except for small-claims matters or injunctive relief for IP or
          unauthorized access, any dispute arising from these Terms or the Service shall be resolved by binding
          arbitration administered by the Centro de Arbitraje y Conciliación de la Cámara de Comercio de Bogotá (or
          another mutually agreed forum) under its rules, in Bogotá, {e.country}, in Spanish or English as the
          parties agree. The arbitrator may award the same damages a court could, subject to the liability limits
          in these Terms.
        </p>
        <p className="mt-3">
          <strong>Class waiver.</strong> To the extent permitted by law, disputes must be brought only in an
          individual capacity, not as a class or representative action.
        </p>
        <p className="mt-3">
          <strong>Governing law.</strong> These Terms are governed by the laws of the {e.governingLaw}, without
          regard to conflict-of-law rules, except that mandatory consumer protections in your country of residence
          may apply.
        </p>
      </section>

      <section id="general">
        <h2>13. General</h2>
        <ul>
          <li>These Terms are the entire agreement unless a signed enterprise order form says otherwise.</li>
          <li>You may not assign without our consent; we may assign in connection with a business transfer.</li>
          <li>Failure to enforce a provision is not a waiver.</li>
          <li>Notices to you may be sent to your account email or billing contact.</li>
        </ul>
        <p className="mt-3">
          Questions: <a href={`mailto:${e.contactEmail}`}>{e.contactEmail}</a>.
        </p>
      </section>
    </>
  );
}
