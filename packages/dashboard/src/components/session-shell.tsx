import Link from "next/link";
import { DeskLogo } from "@/components/desk-logo";

/** Chrome for logged-in flows outside the dashboard layout (onboarding, billing). */
export function SessionShell({
  children,
  eyebrow = "Tu cuenta Desk",
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/dashboard" className="shrink-0">
            <DeskLogo variant="header" href="/dashboard" />
          </Link>
          <p className="text-sm text-[var(--muted)]">{eyebrow}</p>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
