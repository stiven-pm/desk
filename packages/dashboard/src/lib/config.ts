function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function requireApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_API_URL en el build. Usa desk:deploy con export_dashboard_build_env.",
    );
  }
  return normalizeUrl(url);
}

/** API pública: env del build o URL devuelta por `/v1/public/*` bootstrap. */
export function resolvePublicApiUrl(bootstrapApiUrl?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return normalizeUrl(fromEnv);
  const fromBoot = bootstrapApiUrl?.trim();
  if (fromBoot) return normalizeUrl(fromBoot);
  throw new Error(
    "Falta NEXT_PUBLIC_API_URL en el build. Usa desk:deploy con export_dashboard_build_env.",
  );
}

export function requireAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_APP_URL en el build. Usa desk:deploy con export_dashboard_build_env.",
    );
  }
  return url.replace(/\/$/, "");
}
