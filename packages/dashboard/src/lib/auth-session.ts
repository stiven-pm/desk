import { api } from "@/lib/api";

const TOKEN_KEY = "token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function validateSessionToken(
  token: string,
): Promise<{ ok: true } | { ok: false }> {
  try {
    await api<{ org: { status: string } }>("/v1/admin/me", { token });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Rutas de marketing donde una sesión activa no debería quedarse (evita “otra cuenta” accidental). */
export function isMarketingAuthRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname === "/register") return true;
  if (pathname === "/pricing" || pathname === "/plataforma") return true;
  return false;
}
