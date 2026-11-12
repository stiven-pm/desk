import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_ENTITY } from "@/content/legal/entity";

export function LegalProse({
  title,
  lastUpdated,
  lang,
  children,
  nav,
  alternate,
}: {
  title: string;
  lastUpdated: string;
  lang: "en" | "es";
  children: ReactNode;
  nav?: { href: string; label: string }[];
  /** Link to the other language version of the same document. */
  alternate?: { href: string; label: string };
}) {
  const alt =
    alternate ??
    (lang === "en"
      ? { href: "/privacidad", label: "Español" }
      : { href: "/privacy", label: "English" });

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {lang === "en" ? "Last updated" : "Última actualización"}: {lastUpdated} ·{" "}
        {LEGAL_ENTITY.legalName}
        {LEGAL_ENTITY.taxId ? ` · NIT ${LEGAL_ENTITY.taxId}` : ""} ·{" "}
        <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
          {LEGAL_ENTITY.contactEmail}
        </a>
      </p>
      <p className="mt-2 text-sm">
        <Link href={alt.href} className="underline underline-offset-2">
          {alt.label}
        </Link>
        {" · "}
        <Link href="/legal" className="underline underline-offset-2">
          {lang === "en" ? "Legal hub" : "Centro legal"}
        </Link>
      </p>
      {nav && nav.length > 0 ? (
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="underline underline-offset-2">
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
      <div className="legal-prose mt-10 space-y-8 [&_h2]:font-display [&_h2]:text-xl [&_h3]:mt-4 [&_h3]:font-medium [&_li]:text-[var(--muted)] [&_p]:text-[var(--muted)] [&_table]:mt-3 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-[var(--border)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--border)] [&_th]:bg-[var(--muted-bg)] [&_th]:p-2 [&_th]:text-left [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-12 text-xs text-[var(--muted)]">
        {lang === "en"
          ? "This document describes how we operate Desk. It is not legal advice. Enterprise customers may request a signed Data Processing Addendum at "
          : "Este documento describe cómo operamos Desk. No constituye asesoría jurídica. Clientes enterprise pueden solicitar un anexo de tratamiento firmado en "}
        <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline">
          {LEGAL_ENTITY.contactEmail}
        </a>
        .
      </p>
    </article>
  );
}
