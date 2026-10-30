export function isLegacyPublicOrderRef(key: string): boolean {
  return /^RK-/i.test(key.trim());
}
