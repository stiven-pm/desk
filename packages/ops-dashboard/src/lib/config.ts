export function requireApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_API_URL en el build del panel ops. Ejecuta deploy con export_ops_build_env.",
    );
  }
  return url.replace(/\/$/, "");
}
