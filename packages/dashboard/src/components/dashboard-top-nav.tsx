"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeskLogo } from "@/components/desk-logo";
import { DashboardProfileMenu } from "@/components/dashboard-profile-menu";
import { useNativeInventory } from "@/lib/use-native-inventory";
import { useMemberAccess } from "@/lib/member-access-context";
import {
  canOpenBilling,
  canOpenMetrics,
  canOpenPanel,
  hasCapability,
} from "@/lib/member-access-ui";

type NavTab = {
  href: string;
  label: string;
  isActive: (p: string) => boolean;
};

const BASE_TABS: NavTab[] = [
  {
    href: "/dashboard/metrics",
    label: "Inicio",
    isActive: (p: string) => p === "/dashboard/metrics",
  },
  {
    href: "/dashboard/panel",
    label: "Bandeja",
    isActive: (p: string) =>
      p === "/dashboard/panel" ||
      p === "/dashboard/documents" ||
      p.startsWith("/dashboard/bots"),
  },
  {
    href: "/dashboard/billing",
    label: "Uso",
    isActive: (p: string) => p === "/dashboard/billing",
  },
];

export function DashboardTopNav() {
  const pathname = usePathname() ?? "";
  const { enabled: inventoryOn } = useNativeInventory();
  const member = useMemberAccess();

  let tabs: NavTab[] = [...BASE_TABS];
  if (inventoryOn && (hasCapability(member, "knowledge") || member.role === "owner" || member.role === "admin")) {
    tabs = [
      ...tabs.slice(0, 2),
      {
        href: "/dashboard/products",
        label: "Catálogo",
        isActive: (p: string) => p === "/dashboard/products",
      },
      {
        href: "/dashboard/orders",
        label: "Ventas",
        isActive: (p: string) => p === "/dashboard/orders",
      },
      ...tabs.slice(2),
    ];
  }

  tabs = tabs.filter((tab) => {
    if (tab.href === "/dashboard/metrics") return canOpenMetrics(member);
    if (tab.href === "/dashboard/panel") return canOpenPanel(member);
    if (tab.href === "/dashboard/billing") return canOpenBilling(member);
    return true;
  });

  return (
    <header
      className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5 pb-3 sm:px-6"
      aria-label="Navegación del panel"
    >
      <DeskLogo variant="mark" href="/dashboard/metrics" />
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "relative shrink-0 px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                active
                  ? "font-semibold text-[var(--foreground)]"
                  : "font-medium text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {tab.label}
              {active ? (
                <span
                  className="absolute inset-x-1.5 -bottom-2 h-0.5 rounded-full bg-[var(--foreground)]"
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
      <DashboardProfileMenu />
    </header>
  );
}
