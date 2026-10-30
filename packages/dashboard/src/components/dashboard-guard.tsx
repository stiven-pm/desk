"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DashboardTopNav } from "@/components/dashboard-top-nav";
import { DashboardSettingsHeader } from "@/components/dashboard-settings-header";
import { DashboardProfileMenu } from "@/components/dashboard-profile-menu";
import { NativeInventoryProvider } from "@/lib/use-native-inventory";
import {
  MemberAccessProvider,
  capabilitiesFromMe,
  type MePayload,
} from "@/lib/member-access-context";
import {
  defaultPanelHome,
  routeAllowed,
} from "@/lib/member-access-ui";
import type { MemberCapability } from "@chatbot/domain";

type OrgState = { status: string; plan_slug: string; name?: string };

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [org, setOrg] = useState<OrgState | null>(null);
  const [member, setMember] = useState<MePayload | null>(null);
  const [ready, setReady] = useState(false);

  const active = org?.status === "active";
  const isSettings = pathname === "/dashboard/configuracion";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
      return;
    }
    api<{
      org: OrgState;
      user: { role?: string; capabilities?: MemberCapability[]; email?: string };
    }>("/v1/admin/me", { token })
      .then((d) => {
        setOrg(d.org as OrgState);
        setMember({
          ...capabilitiesFromMe(d.user),
          email: d.user?.email,
        });
        const allowedInactive =
          pathname === "/dashboard" || pathname === "/dashboard/configuracion";
        if (d.org?.status !== "active" && !allowedInactive) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        router.replace("/login");
      })
      .finally(() => setReady(true));
  }, [pathname, router]);

  useEffect(() => {
    if (!member || !pathname || !active) return;
    if (!routeAllowed(member, pathname)) {
      router.replace(defaultPanelHome(member));
    }
  }, [member, pathname, active, router]);

  if (!ready) {
    return (
      <p className="px-6 py-10 text-sm text-[var(--muted)]">Cargando panel…</p>
    );
  }

  return (
    <MemberAccessProvider value={member}>
    <NativeInventoryProvider>
      <div className={isSettings ? "min-h-screen bg-[var(--background)]" : undefined}>
        {isSettings ? (
          <>
            <DashboardSettingsHeader />
            {!active ? (
              <p className="border-b border-[var(--border)] bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:px-6">
                Activa tu plan para usar el chat y vender.{" "}
                <a href="mailto:contact@rekov.co" className="underline underline-offset-2">
                  contact@rekov.co
                </a>
              </p>
            ) : null}
          </>
        ) : active ? (
          <DashboardTopNav />
        ) : (
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--muted-bg)]/50 px-4 py-2.5 sm:px-6">
            <p className="text-sm text-[var(--muted)]">
              Elige un plan para usar Desk.{" "}
              <a href="mailto:contact@rekov.co" className="underline underline-offset-2">
                contact@rekov.co
              </a>
            </p>
            <DashboardProfileMenu />
          </header>
        )}
        {children}
      </div>
    </NativeInventoryProvider>
    </MemberAccessProvider>
  );
}
