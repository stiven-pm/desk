import { LEGAL_ENTITY } from "./entity";

export const privacyNavEn = [
  { href: "#collect", label: "Data we collect" },
  { href: "#use", label: "How we use data" },
  { href: "#chat-web", label: "Web chat" },
  { href: "#ai", label: "AI disclosure" },
  { href: "#share", label: "Sharing" },
  { href: "#retention", label: "Retention" },
  { href: "#security", label: "Security" },
  { href: "#rights", label: "Your rights" },
  { href: "#international", label: "International" },
  { href: "#children", label: "Children" },
  { href: "#changes", label: "Changes" },
];

export function PrivacyPolicyEn() {
  const e = LEGAL_ENTITY;
  return (
    <>
      <section>
        <p>
          {e.legalName} (&quot;{e.brand}&quot;, &quot;we&quot;, &quot;us&quot;) operates {e.productName}, a
          cloud software platform that lets business customers (&quot;Customers&quot; or &quot;tenants&quot;)
          reply with AI assistance to their own customers (&quot;End Users&quot;) via hosted web chat and storefront. This
          Privacy Policy explains how we collect, use, disclose, and retain personal information when you use{" "}
          <a href={e.siteUrl}>{e.siteUrl}</a>, our APIs, web chat, dashboard, billing, and related
          services (the &quot;Service&quot;).
        </p>
        <p className="mt-3">
          <strong>Two roles.</strong> For account, billing, and platform data, we are the data controller. For
          conversation content, uploaded files, and data processed on a Customer&apos;s instructions, we act as a
          processor/service provider on behalf of that Customer. Customers must provide their own privacy notice
          to End Users and obtain any required consent (including for automated messaging and AI).
        </p>
      </section>

      <section id="collect">
        <h2>Personal information we collect</h2>
        <h3>Information you provide</h3>
        <ul>
          <li>
            <strong>Account data:</strong> name, email, organization name, password (stored as a one-way hash),
            team invitations, role assignments.
          </li>
          <li>
            <strong>Billing data:</strong> subscription plan, payment history, tax location where collected by our
            payment processor. We do not store full payment card numbers on our servers.
          </li>
          <li>
            <strong>Customer content:</strong> bot instructions, knowledge-base documents, PDFs, images, videos
            (when uploaded), API/MCP integration settings, webhook URLs, and encrypted integration credentials.
          </li>
          <li>
            <strong>Communications:</strong> support requests, security reports, and email you send us.
          </li>
        </ul>
        <h3>End User data (processed for Customers)</h3>
        <ul>
          <li>
            <strong>Identifiers:</strong> visitor session id; phone or email if provided.
          </li>
          <li>
            <strong>Messages:</strong> message text, optional attachments, automated replies, conversation metadata
            (timestamps, delivery status, assistant identifier).
          </li>
        </ul>
        <h3>Automatic collection (dashboard & marketing site)</h3>
        <ul>
          <li>
            <strong>Device and usage data:</strong> pages viewed, referrers, cookies or similar technologies on our
            marketing pages and authenticated dashboard (see{" "}
            <a href="/legal/cookies">Cookie Notice</a>).
          </li>
          <li>
            <strong>Logs and network data:</strong> IP address, API request metadata, error traces, audit events for
            security and billing metering. In chat, Cloudflare may attach approximate network data at the edge (e.g.
            country or city) for session context and security — <strong>without</strong> third-party IP geolocation
            services (see <a href="/legal/cookies">Cookie Notice</a>).
          </li>
        </ul>
        <h3 id="label">Privacy nutrition label (summary)</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Examples</th>
              <th>Sold?</th>
              <th>Shared for service?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identifiers</td>
              <td>Email, org name, visitor identifiers</td>
              <td>No</td>
              <td>Yes — infrastructure &amp; AI inference</td>
            </tr>
            <tr>
              <td>Commercial</td>
              <td>Plan, usage, invoices via payment processor</td>
              <td>No</td>
              <td>Yes — payment processor</td>
            </tr>
            <tr>
              <td>Internet / technical</td>
              <td>IP, logs, cookies</td>
              <td>No</td>
              <td>Yes — hosting &amp; security</td>
            </tr>
            <tr>
              <td>User-generated content</td>
              <td>Chat messages, uploads (PDF/image/video)</td>
              <td>No</td>
              <td>Yes — on Customer instruction</td>
            </tr>
            <tr>
              <td>Inferences</td>
              <td>Embeddings for search; AI replies (not used to train public models)</td>
              <td>No</td>
              <td>Yes — cloud AI runtime</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3">
          We do <strong>not</strong> sell personal information. We do <strong>not</strong> use Customer
          conversation content or uploaded documents to train our own or third-party foundation models. Inference
          providers process content only to deliver the Service for that request.
        </p>
      </section>

      <section id="use">
        <h2>How we use personal information</h2>
        <ul>
          <li>Provide, secure, and improve the Service (hosting, multi-tenant isolation, metering, support).</li>
          <li>Generate AI-assisted replies and retrieval over Customer-approved knowledge.</li>
          <li>Process subscriptions and wallet top-ups through our payment partner.</li>
          <li>Detect abuse, fraud, and violations of our Terms.</li>
          <li>Comply with law and respond to lawful requests.</li>
          <li>Send service and security communications; marketing only with consent or where permitted.</li>
        </ul>
        <p className="mt-3">
          <strong>Legal bases (EEA/UK):</strong> contract performance, legitimate interests (security, product
          improvement), consent where required (e.g., non-essential cookies), and legal obligation.
        </p>
      </section>

      <section id="chat-web">
        <h2>Web chat</h2>
        <p>
          When a Customer publishes chat or storefront on {e.productName}, we process messages and data End Users
          submit to generate the automated replies the Customer configures. The Customer is responsible for
          privacy notices and consent required in their jurisdiction.
        </p>
      </section>

      <section id="ai">
        <h2>Artificial intelligence (FTC-style disclosure)</h2>
        <p>
          End Users interacting with a Customer&apos;s bot may receive <strong>automated</strong> responses
          generated by large language models and retrieval systems. Outputs can be inaccurate or incomplete.
          Customers should disclose automated interaction where required (including U.S. FTC guidance on AI and
          bots). Sensitive decisions (payments, legal, medical) should involve human review when appropriate.
        </p>
        <p className="mt-3">
          Uploaded images, PDFs, and videos may be parsed or transcribed to extract text for search and replies;
          binary files remain stored under the Customer&apos;s retention policy.
        </p>
      </section>

      <section id="share">
        <h2>How we share information</h2>
        <p>We share personal information only with:</p>
        <ul>
          <li>
            <strong>Cloudflare, Inc.</strong> — hosting, D1, R2, Workers, Workers AI, Vectorize, and transactional
            email when enabled.
          </li>
          <li>
            <strong>Creem</strong> — subscriptions and one-time wallet top-ups.
          </li>
          <li>
            <strong>Customer-configured integrations</strong> — APIs, webhooks, and MCP servers you choose.
          </li>
          <li>
            <strong>Professional advisers</strong> and authorities when required by law or to protect rights and
            safety.
          </li>
          <li>
            <strong>Business transfers</strong> in connection with merger, acquisition, or asset sale, with notice
            where required.
          </li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> use third-party IP geolocation services (such as ip.guide or ipquery.io).
          Approximate location (e.g. country or city) may come only from Cloudflare edge headers when operating the
          chat, for session context and security.
        </p>
        <p className="mt-3">
          We do <strong>not</strong> sell Platform Data or share it with third parties for advertising. We use
          contracted subprocessors only to operate the Service.
        </p>
        <p className="mt-3" id="authorities">
          <strong>Government requests.</strong> We review the legality of law-enforcement and public-authority
          requests, disclose only the minimum necessary information, document requests and responses, and may
          challenge requests we believe are unlawful, unless prohibited by law.
        </p>
        <p className="mt-3">
          A current subprocessor list is available on request at {e.privacyEmail}. Material changes will be notified
          to active account administrators.
        </p>
      </section>

      <section id="retention">
        <h2>Retention</h2>
        <p>
          We retain account data while the subscription is active and for a reasonable period afterward for
          legal, tax, and dispute resolution. Conversation retention follows the Customer&apos;s plan limits
          (published on our pricing page). Backups may persist for a limited window after deletion. Customers can
          export or delete organization data from the dashboard where features are available, or request assistance
          at {e.privacyEmail}.
        </p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <ul>
          <li>TLS (HTTPS) for data in transit between clients and our edge.</li>
          <li>Logical multi-tenant isolation per organization; role-based access inside each tenant.</li>
          <li>Passwords hashed; API keys and integration secrets encrypted at rest.</li>
          <li>Operational logging, monitoring, and rate limiting to mitigate abuse.</li>
          <li>Backup and recovery procedures aligned with our cloud provider; no method is 100% secure.</li>
        </ul>
        <p className="mt-3">
          Report vulnerabilities to {e.securityEmail}. If we confirm a breach affecting personal data, we will
          notify Customers and regulators as required by applicable law.
        </p>
      </section>

      <section id="rights">
        <h2>Your privacy rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, restrict, port, or object to
          processing, and to withdraw consent. California residents have rights under the CCPA/CPRA (know, delete,
          correct, opt out of sale/sharing — we do not sell). Colombian residents may exercise rights under Law
          1581 of 2012 by writing to {e.privacyEmail}.
        </p>
        <p className="mt-3">
          <strong>End Users:</strong> contact the business that operates the chat first. We will assist the
          Customer in fulfilling requests where we process data on their behalf.
        </p>
        <p className="mt-3">
          EU/UK residents may lodge a complaint with their supervisory authority. Our contact for GDPR requests:{" "}
          {e.privacyEmail}.
        </p>
      </section>

      <section id="international">
        <h2>International transfers</h2>
        <p>
          We are established in {e.country}. Data may be processed in the United States and other countries where
          our subprocessors operate. We rely on appropriate safeguards (such as Standard Contractual Clauses where
          applicable) and vendor security commitments for cross-border transfers.
        </p>
      </section>

      <section id="children">
        <h2>Children</h2>
        <p>
          The Service is not directed to children under 16 (or under 13 in the U.S. without parental consent).
          Customers must not deploy the Service to collect children&apos;s data unlawfully.
        </p>
      </section>

      <section id="changes">
        <h2>Changes</h2>
        <p>
          We may update this Policy. We will post the revision date and, for material changes, notify account
          administrators by email or in-product notice. Continued use after notice constitutes acceptance where
          permitted by law.
        </p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>
          Data controller: {e.legalName}, {e.country}. Email:{" "}
          <a href={`mailto:${e.privacyEmail}`}>{e.privacyEmail}</a>.
        </p>
      </section>
    </>
  );
}
