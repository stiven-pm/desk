import Link from "next/link";
import { Suspense } from "react";
import { DeskLogo } from "@/components/desk-logo";
import { MarketingAuthRedirect } from "@/components/marketing-auth-redirect";

export function MarketingShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="desk-grain min-h-screen">
      <Suspense fallback={null}>
        <MarketingAuthRedirect />
      </Suspense>
      <header className="border-b border-[var(--desk-border)] bg-[var(--desk-black)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <DeskLogo variant="header" />
          <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm">
            <Link href="/plataforma" className="text-[var(--desk-muted)] hover:text-[var(--desk-white)]">
              Plataforma
            </Link>
            <Link href="/pricing" className="text-[var(--desk-muted)] hover:text-[var(--desk-white)]">
              Precios
            </Link>
            <Link href="/legal#seguridad" className="text-[var(--desk-muted)] hover:text-[var(--desk-white)]">
              Seguridad
            </Link>
            <Link href="/legal" className="text-[var(--desk-muted)] hover:text-[var(--desk-white)]">
              Legal
            </Link>
            <Link href="/login" className="text-[var(--desk-muted)] hover:text-[var(--desk-white)]">
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-[var(--radius-sm)] border border-[var(--desk-border)] bg-transparent px-3.5 py-2 text-sm font-medium text-[var(--desk-white)] hover:bg-[var(--desk-surface)]"
            >
              Crear mi asistente
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-[var(--border)] bg-[var(--card)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <p>Desk — respuestas con tus datos, excepciones con tu equipo.</p>
          <p>
            <Link href="/privacidad" className="underline underline-offset-2 hover:text-[var(--foreground)]">
              Privacidad
            </Link>
            {" · "}
            <Link href="/terminos" className="underline underline-offset-2 hover:text-[var(--foreground)]">
              Términos
            </Link>
            {" · "}
            <Link href="/legal" className="underline underline-offset-2 hover:text-[var(--foreground)]">
              Legal
            </Link>
            {" · "}
            <a href="mailto:contact@rekov.co" className="underline underline-offset-2 hover:text-[var(--foreground)]">
              contact@rekov.co
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
