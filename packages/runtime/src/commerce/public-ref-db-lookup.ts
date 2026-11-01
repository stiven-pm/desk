import { resolvePublicOrderRefForLookup } from "@chatbot/domain";

/** Bindings: canonical ref, LIKE pattern, digit-only suffix. */
export function publicRefSqlBindings(
  raw: string,
): [string, string, string] | null {
  const resolved = resolvePublicOrderRefForLookup(raw);
  if (!resolved) return null;
  return [
    resolved.canonical,
    `%${resolved.digitSuffix}%`,
    resolved.digitSuffix,
  ];
}

export function publicRefWhereClause(column = "public_ref"): string {
  return `(
  UPPER(TRIM(${column})) = ?
  OR ${column} LIKE ?
  OR REPLACE(REPLACE(UPPER(TRIM(${column})), 'RK-', ''), '-', '') = ?
)`;
}
