import { DeskLogo } from "@/components/desk-logo";

const NAV = [
  { label: "Inicio", active: false },
  { label: "Bandeja", active: false },
  { label: "Uso", active: false },
] as const;

export type MarketingConfigTab = "cuenta" | "web" | "integraciones" | "ia" | "equipo";

const CONFIG_TABS: { id: MarketingConfigTab; label: string }[] = [
  { id: "cuenta", label: "Cuenta" },
  { id: "web", label: "Web" },
  { id: "integraciones", label: "Integraciones" },
  { id: "ia", label: "IA" },
  { id: "equipo", label: "Equipo" },
];

export function MarketingDashboardChrome({
  children,
  activeNav = "none",
  configTab = "ia",
  showConfigTabs = true,
}: {
  children: React.ReactNode;
  activeNav?: "none" | "bandeja" | "inicio" | "uso";
  configTab?: MarketingConfigTab;
  showConfigTabs?: boolean;
}) {
  return (
    <div
      className="pointer-events-none select-none overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[0_8px_30px_oklch(0.2_0.02_55/0.08)]"
      aria-hidden
    >
      <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5 pb-3 sm:px-5">
        <DeskLogo variant="mark" />
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          {NAV.map((tab) => {
            const active =
              (activeNav === "inicio" && tab.label === "Inicio") ||
              (activeNav === "bandeja" && tab.label === "Bandeja") ||
              (activeNav === "uso" && tab.label === "Uso");
            return (
              <span
                key={tab.label}
                className={[
                  "relative shrink-0 px-2.5 py-1.5 text-sm sm:px-3",
                  active
                    ? "font-semibold text-[var(--foreground)]"
                    : "font-medium text-[var(--muted)]",
                ].join(" ")}
              >
                {tab.label}
                {active ? (
                  <span
                    className="absolute inset-x-1.5 -bottom-2 h-0.5 rounded-full bg-[var(--foreground)]"
                    aria-hidden
                  />
                ) : null}
              </span>
            );
          })}
        </nav>
        <span
          className="hidden size-8 shrink-0 rounded-full bg-[var(--muted-bg)] sm:block"
          aria-hidden
        />
      </header>

      <div className="bg-[var(--background)] px-4 py-5 sm:px-5">
        {showConfigTabs ? (
          <>
            <p className="text-xs text-[var(--muted)]">Configuración</p>
            <div className="mt-3 flex flex-wrap gap-1 border-b border-[var(--border)]">
              {CONFIG_TABS.map((t) => (
                <span
                  key={t.id}
                  className={[
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    configTab === t.id
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--muted)]",
                  ].join(" ")}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </>
        ) : null}
        <div className={showConfigTabs ? "mt-6" : ""}>{children}</div>
      </div>
    </div>
  );
}
