"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  clearSession,
  getSessionToken,
  isMarketingAuthRoute,
  validateSessionToken,
} from "@/lib/auth-session";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Si hay JWT válido, no deja navegar por home/precios/registro/login de marketing.
 * Login con ?logout=1 limpia sesión antes de mostrar el formulario.
 */
export function MarketingAuthRedirect() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!isMarketingAuthRoute(pathname)) return;

    const logout = searchParams.get("logout") === "1";
    if (logout) {
      clearSession();
      if (pathname !== "/login") {
        router.replace("/login?logout=1");
      }
      return;
    }

    const token = getSessionToken();
    if (!token) return;

    let cancelled = false;
    void validateSessionToken(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        clearSession();
        return;
      }
      const next = safeNextPath(searchParams.get("next"), "/dashboard/metrics");
      router.replace(pathname === "/login" ? next : "/dashboard/metrics");
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParams]);

  return null;
}
