/** Panel permissions (combinable on one user). */
export type MemberCapability =
  | "billing"
  | "team"
  | "knowledge"
  | "integrations"
  | "inbox"
  | "analytics";

export const ALL_MEMBER_CAPABILITIES: MemberCapability[] = [
  "billing",
  "team",
  "knowledge",
  "integrations",
  "inbox",
  "analytics",
];

export type MemberRole =
  | "owner"
  | "admin"
  | "agent"
  | "developer"
  | "viewer"
  | "member";

const ROLE_CAPABILITIES: Record<MemberRole, MemberCapability[]> = {
  owner: ALL_MEMBER_CAPABILITIES,
  admin: ALL_MEMBER_CAPABILITIES,
  developer: ["knowledge", "integrations", "analytics"],
  agent: ["inbox"],
  viewer: ["analytics"],
  member: [],
};

/** Legacy route checks map roles to the capabilities they imply. */
const ROLE_ROUTE_CAPS: Record<string, MemberCapability[]> = {
  owner: ALL_MEMBER_CAPABILITIES,
  admin: ALL_MEMBER_CAPABILITIES,
  developer: ["knowledge", "integrations"],
  agent: ["inbox"],
  viewer: ["analytics"],
};

export function parseCapabilitiesJson(
  raw: string | null | undefined,
): MemberCapability[] | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const allowed = new Set(ALL_MEMBER_CAPABILITIES);
    const out = parsed.filter(
      (c): c is MemberCapability =>
        typeof c === "string" && allowed.has(c as MemberCapability),
    );
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

export function serializeCapabilities(
  caps: MemberCapability[],
): string {
  return JSON.stringify([...new Set(caps)].sort());
}

export function resolveMemberCapabilities(
  role: string,
  capabilitiesJson?: string | null,
): MemberCapability[] {
  const custom = parseCapabilitiesJson(capabilitiesJson);
  if (custom?.length) return custom;
  const preset = ROLE_CAPABILITIES[role as MemberRole];
  if (preset) return preset;
  return ROLE_CAPABILITIES.member;
}

export function memberHasCapability(
  caps: MemberCapability[],
  needed: MemberCapability,
): boolean {
  return caps.includes(needed);
}

/** True if user may access a route that listed legacy roles (owner, developer, …). */
export function canAccessLegacyRoles(
  role: string,
  capabilitiesJson: string | null | undefined,
  allowedRoles: string[],
): boolean {
  if (allowedRoles.includes(role)) return true;

  const custom = parseCapabilitiesJson(capabilitiesJson);
  const userCaps = resolveMemberCapabilities(role, capabilitiesJson);

  for (const r of allowedRoles) {
    if (r === "owner" || r === "admin") continue;
    for (const c of ROLE_ROUTE_CAPS[r] ?? []) {
      if (memberHasCapability(userCaps, c)) return true;
    }
  }

  if (custom?.length) return false;

  for (const r of allowedRoles) {
    for (const c of ROLE_ROUTE_CAPS[r] ?? []) {
      if (memberHasCapability(userCaps, c)) return true;
    }
  }
  return false;
}

export function validateCapabilitySelection(
  caps: MemberCapability[],
): { ok: true } | { ok: false; code: string } {
  if (!caps.length) return { ok: false, code: "capabilities_required" };
  const allowed = new Set(ALL_MEMBER_CAPABILITIES);
  for (const c of caps) {
    if (!allowed.has(c)) return { ok: false, code: "invalid_capability" };
  }
  return { ok: true };
}
