import { randomId } from "./http";

export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function stableSlugSuffix(currentSlug: string): string {
  const i = currentSlug.lastIndexOf("-");
  if (i > 0) {
    const suf = currentSlug.slice(i + 1);
    if (/^[a-z0-9]{4,10}$/i.test(suf)) return suf;
  }
  return randomId().slice(0, 6);
}

export function buildOrgSlugFromName(name: string, suffix: string): string {
  const base = slugifyOrgName(name) || "empresa";
  return `${base}-${suffix}`.slice(0, 64);
}
