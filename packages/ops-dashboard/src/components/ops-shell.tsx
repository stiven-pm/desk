"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/metrics", label: "Métricas" },
  { href: "/orgs", label: "Empresas" },
] as const;

const MARK = "/brand/desk-mark-white.jpg";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  function logout() {
    localStorage.removeItem("ops_token");
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[var(--ops-surface)]">
      <header className="border-b border-[var(--ops-border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 pb-3 sm:px-6">
          <Link href="/metrics" className="shrink-0" aria-label="Desk Ops">
            <img
              src={MARK}
              alt=""
              width={32}
              height={32}
              className="h-7 w-7 rounded-md"
              decoding="async"
            />
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {NAV.map((n) => {
              const active =
                pathname === n.href ||
                (n.href !== "/metrics" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative shrink-0 px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                    active
                      ? "font-semibold text-[var(--ops-ink)]"
                      : "font-medium text-[var(--ops-muted)] hover:text-[var(--ops-ink)]",
                  ].join(" ")}
                >
                  {n.label}
                  {active ? (
                    <span
                      className="absolute inset-x-1.5 -bottom-2 h-0.5 rounded-full bg-[var(--ops-ink)]"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 text-xs text-[var(--ops-muted)] hover:text-[var(--ops-ink)]"
          >
            Salir
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
