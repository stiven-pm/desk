"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth-session";
import { useMemberAccess } from "@/lib/member-access-context";
import { canOpenSettings } from "@/lib/member-access-ui";

type AccountSummary = {
  org: { name: string } | null;
};

export function DashboardProfileMenu() {
  const member = useMemberAccess();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgName, setOrgName] = useState<string>("Mi empresa");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<AccountSummary>("/v1/admin/account")
      .then((d) => {
        if (d.org?.name) setOrgName(d.org.name);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function signOut() {
    clearSession();
    router.replace("/login?logout=1");
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[10rem] items-center gap-1.5 truncate rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] sm:max-w-[14rem]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="truncate">{orgName}</span>
        <span className="text-[var(--muted)]" aria-hidden>▾</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-md"
        >
          <p className="px-3 py-2 text-xs font-semibold text-[var(--foreground)] truncate">
            {orgName}
          </p>
          <hr className="border-[var(--border)]" />
          {canOpenSettings(member) ? (
            <Link
              href="/dashboard/configuracion"
              role="menuitem"
              className="block px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
              onClick={() => setOpen(false)}
            >
              Configuración
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted-bg)]"
            onClick={signOut}
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
