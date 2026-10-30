"use client";

import type { MemberCapability } from "@chatbot/domain";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { PanelMember } from "@/lib/member-access-ui";

export type MePayload = PanelMember & {
  email?: string;
};

const MemberAccessContext = createContext<MePayload | null>(null);

export function MemberAccessProvider({
  value,
  children,
}: {
  value: MePayload | null;
  children: ReactNode;
}) {
  return (
    <MemberAccessContext.Provider value={value}>
      {children}
    </MemberAccessContext.Provider>
  );
}

export function useMemberAccess(): MePayload {
  const ctx = useContext(MemberAccessContext);
  if (!ctx) {
    return { role: "agent", capabilities: ["inbox", "analytics"] };
  }
  return ctx;
}

export function capabilitiesFromMe(
  user: { role?: string; capabilities?: MemberCapability[] } | undefined,
): MePayload {
  const role = user?.role ?? "member";
  const capabilities = user?.capabilities?.length
    ? user.capabilities
    : role === "owner" || role === "admin"
      ? ([
          "billing",
          "team",
          "knowledge",
          "integrations",
          "inbox",
          "analytics",
        ] as MemberCapability[])
      : (["inbox", "analytics"] as MemberCapability[]);
  return { role, capabilities };
}
