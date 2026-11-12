import type { Metadata } from "next";
import Link from "next/link";
import { PUBLIC_BUYER_FAQ } from "@chatbot/domain";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_ENTITY } from "@/content/legal/entity";

export const metadata: Metadata = {
  title: "Preguntas frecuentes (compradores) | Desk",
  description:
    "Pagos Creem, créditos y mensajes por plan, topes, reembolsos, Cloudflare IA, privacidad y cancelación — Desk by Rekov Systems.",
  alternates: { canonical: "/preguntas" },
};

export default function PreguntasPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
        <h1 className="font-display text-3xl">Preguntas frecuentes</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Respuestas directas para evaluar Desk antes de pagar. {LEGAL_ENTITY.legalName} · NIT {LEGAL_ENTITY.taxId}
        </p>
        <p className="mt-2 text-sm">
          <Link href="/pricing" className="underline underline-offset-2">
            Precios
          </Link>
          {" · "}
          <Link href="/privacidad" className="underline underline-offset-2">
            Privacidad
          </Link>
          {" · "}
          <Link href="/terminos" className="underline underline-offset-2">
            Términos
          </Link>
          {" · "}
          <Link href="/legal" className="underline underline-offset-2">
            Centro legal
          </Link>
        </p>

        <div className="mt-10 space-y-10">
          {PUBLIC_BUYER_FAQ.map((item) => (
            <section key={item.id} id={item.id}>
              <h2 className="font-display text-xl">{item.q}</h2>
              <p className="mt-3 leading-relaxed text-[var(--muted)]">{item.a}</p>
            </section>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
