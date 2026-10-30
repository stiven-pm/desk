import type { MemberCapability } from "@chatbot/domain";

export type PanelMember = {
  role: string;
  capabilities: MemberCapability[];
};

export function memberCaps(m: PanelMember): MemberCapability[] {
  return m.capabilities ?? [];
}

export function hasCapability(
  m: PanelMember,
  cap: MemberCapability,
): boolean {
  return memberCaps(m).includes(cap);
}

export function isInboxOnlyAgent(m: PanelMember): boolean {
  if (m.role === "owner" || m.role === "admin") return false;
  const caps = memberCaps(m);
  if (m.role === "agent") return true;
  return caps.length === 1 && caps[0] === "inbox";
}

export function canOpenAccountSettings(m: PanelMember): boolean {
  return m.role === "owner" || m.role === "admin";
}

export function canOpenIaSettings(m: PanelMember): boolean {
  return (
    canOpenAccountSettings(m) || hasCapability(m, "knowledge")
  );
}

/** Configuración (cualquier pestaña). Los agentes de bandeja no entran. */
export function canOpenSettings(m: PanelMember): boolean {
  if (isInboxOnlyAgent(m)) return false;
  if (canOpenAccountSettings(m)) return true;
  return (
    hasCapability(m, "team") ||
    hasCapability(m, "billing") ||
    hasCapability(m, "knowledge")
  );
}

export function canOpenIntegrations(m: PanelMember): boolean {
  return hasCapability(m, "integrations");
}

export function canOpenBilling(m: PanelMember): boolean {
  return hasCapability(m, "billing");
}

export function canOpenMetrics(m: PanelMember): boolean {
  return hasCapability(m, "analytics");
}

export function canOpenPanel(m: PanelMember): boolean {
  return hasCapability(m, "inbox");
}

export function canManageTeam(m: PanelMember): boolean {
  return hasCapability(m, "team");
}

/** Ruta → capacidad mínima (owner/admin pasan por capabilities completas). */
export function routeAllowed(m: PanelMember, pathname: string): boolean {
  if (isInboxOnlyAgent(m)) {
    return (
      pathname === "/dashboard/panel" || pathname.startsWith("/dashboard/panel/")
    );
  }
  if (pathname.startsWith("/dashboard/configuracion")) {
    return canOpenSettings(m);
  }
  if (pathname.startsWith("/dashboard/billing")) {
    return canOpenBilling(m);
  }
  if (pathname.startsWith("/dashboard/metrics")) {
    return canOpenMetrics(m);
  }
  if (pathname.startsWith("/dashboard/panel")) {
    return canOpenPanel(m);
  }
  if (
    pathname.startsWith("/dashboard/products") ||
    pathname.startsWith("/dashboard/orders")
  ) {
    return (
      hasCapability(m, "knowledge") ||
      hasCapability(m, "integrations") ||
      m.role === "owner" ||
      m.role === "admin"
    );
  }
  if (
    pathname.startsWith("/dashboard/bots") ||
    pathname.startsWith("/dashboard/documents")
  ) {
    return hasCapability(m, "knowledge") || m.role === "owner" || m.role === "admin";
  }
  return true;
}

export const defaultPanelHome = (m: PanelMember): string => {
  if (canOpenPanel(m)) return "/dashboard/panel";
  if (canOpenMetrics(m)) return "/dashboard/metrics";
  return "/dashboard";
};
