"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { orgServiceActive } from "@chatbot/domain";
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

type OrgState = {
  status: string;
  plan_slug: string;
  name?: string;
  trial_ends_at?: string | null;
};

function formatTrialEnd(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [org, setOrg] = useState<OrgState | null>(null);
  const [member, setMember] = useState<MePayload | null>(null);
  const [ready, setReady] = useState(false);

  const serviceActive = org
    ? orgServiceActive(org.status, org.trial_ends_at ?? null)
    : false;
  const onTrial = org?.status === "trial" && serviceActive;
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
          pathname === "/dashboard" ||
          pathname === "/dashboard/configuracion" ||
          pathname === "/dashboard/billing";
        if (!orgServiceActive(d.org?.status, d.org?.trial_ends_at ?? null) && !allowedInactive) {
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
    if (!member || !pathname || !serviceActive) return;
    if (!routeAllowed(member, pathname)) {
      router.replace(defaultPanelHome(member));
    }
  }, [member, pathname, serviceActive, router]);

  const trialBanner = onTrial ? (
    <p className="border-b border-[var(--border)] bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:px-6">
      Prueba hasta {formatTrialEnd(org?.trial_ends_at)}.{" "}
      <Link href="/dashboard/billing" className="underline underline-offset-2">
        Activar plan
      </Link>
    </p>
  ) : null;

  const pendingBanner = !serviceActive ? (
    <p className="border-b border-[var(--border)] bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:px-6">
      {org?.status === "pending" ? "Tu prueba terminó." : "Activa tu plan para usar el chat."}{" "}
      <Link href="/dashboard/billing" className="underline underline-offset-2">
        Elegir plan
      </Link>
    </p>
  ) : null;

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
            {trialBanner}
            {pendingBanner}
          </>
        ) : serviceActive ? (
          <>
            <DashboardTopNav />
            {trialBanner}
          </>
        ) : (
          <>
            <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--muted-bg)]/50 px-4 py-2.5 sm:px-6">
              <p className="text-sm text-[var(--muted)]">
                <Link href="/dashboard/billing" className="underline underline-offset-2">
                  Elegir plan
                </Link>
              </p>
              <DashboardProfileMenu />
            </header>
            {pendingBanner}
          </>
        )}
        {children}
      </div>
    </NativeInventoryProvider>
    </MemberAccessProvider>
  );
}
