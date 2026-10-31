export function isLegacyPublicOrderRef(key: string): boolean {
  return /^RK-/i.test(key.trim());
}

/** UUID en `sales_orders.public_access_token`. */
export function isPublicOrderAccessToken(key: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
    key.trim(),
  );
}

export function isPublicOrderLookupKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  return isLegacyPublicOrderRef(trimmed) || isPublicOrderAccessToken(trimmed);
}
