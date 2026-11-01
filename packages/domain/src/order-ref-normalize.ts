/** Normalización única de referencias RK, teléfonos e identificadores de pedido. */

const RK_IN_TEXT =
  /\bRK[\s._#-]*(\d{2,8})\b|\b(?:ref(?:erencia)?|pedido|orden|order|#)[\s:._#-]*(\d{2,8})\b/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function collapseVisitorWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function rkFromMatch(m: RegExpMatchArray): string | null {
  const digits = m[1] ?? m[2];
  return digits ? `RK-${digits}` : null;
}

/** Canonical `RK-####` desde texto suelto o fragmento de mensaje. */
export function normalizePublicOrderRef(raw: string): string | null {
  const t = collapseVisitorWhitespace(raw);
  if (!t) return null;

  let m = t.match(/\bRK[\s._#-]*(\d{2,8})\b/i);
  if (m) return `RK-${m[1]}`;

  m = t.match(/(?:^|\s)RK(\d{2,8})(?=\s|$|[^0-9a-z])/i);
  if (m) return `RK-${m[1]}`;

  m = t.match(RK_IN_TEXT);
  if (m) return rkFromMatch(m);

  for (const word of t.split(/\s+/)) {
    const loose = normalizePublicOrderRefLoose(word);
    if (loose) return loose;
  }

  const compact = t.replace(/\s+/g, "");
  const compactM = compact.match(/^RK[\s._#-]*(\d{2,8})$/i);
  if (compactM) return `RK-${compactM[1]}`;

  m = compact.match(/RK(\d{2,8})/i);
  if (m) return `RK-${m[1]}`;

  return null;
}

/** Variantes pegadas (`RK5091`, `rk_5091`) cuando no hay word boundary. */
export function normalizePublicOrderRefLoose(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const compact = t.replace(/[\s._#]+/g, "").toUpperCase();
  if (/^RK\d{2,8}$/.test(compact)) {
    return `RK-${compact.slice(2)}`;
  }
  const dashed = t.toUpperCase().replace(/[\s._#]+/g, "-");
  if (/^RK-\d{2,8}$/.test(dashed)) return dashed;
  const digits = t.replace(/\D/g, "");
  if (/^RK/i.test(t) && digits.length >= 2 && digits.length <= 8) {
    return `RK-${digits}`;
  }
  return null;
}

export function extractPublicOrderRefFromText(text: string): string | null {
  return normalizePublicOrderRef(text);
}

export function publicOrderRefNumericSuffix(canonical: string): string {
  return canonical.replace(/^RK-/i, "").replace(/\D/g, "");
}

export function normalizePhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("573")) d = d.slice(2);
  return d;
}

export function normalizeDocumentDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function normalizeTaxIdDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function normalizeEmailAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeOrderUuid(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  return UUID_RE.test(t) ? t : null;
}

export type NativeOrderLookupFields = {
  publicRef?: string;
  orderUuid?: string;
  phone?: string;
  documentId?: string;
  taxId?: string;
  email?: string;
  customerName?: string;
};

export function normalizeNativeOrderLookupFields(
  input: NativeOrderLookupFields,
): NativeOrderLookupFields {
  const out: NativeOrderLookupFields = {};
  if (input.publicRef) {
    const ref =
      normalizePublicOrderRef(input.publicRef) ??
      normalizePublicOrderRefLoose(input.publicRef);
    if (ref) out.publicRef = ref;
  }
  if (input.orderUuid) {
    const u = normalizeOrderUuid(input.orderUuid);
    if (u) out.orderUuid = u;
  }
  if (input.phone) {
    const p = normalizePhoneDigits(input.phone);
    if (p.length >= 7) out.phone = p;
  }
  if (input.documentId) {
    const d = normalizeDocumentDigits(input.documentId);
    if (d.length >= 6) out.documentId = d;
  }
  if (input.taxId) {
    const t = normalizeTaxIdDigits(input.taxId);
    if (t.length >= 6) out.taxId = t;
  }
  if (input.email) {
    const e = normalizeEmailAddress(input.email);
    if (e.includes("@")) out.email = e;
  }
  if (input.customerName) {
    const n = collapseVisitorWhitespace(input.customerName);
    if (n.length >= 2) out.customerName = n;
  }
  return out;
}

export function isLegacyPublicOrderRef(key: string): boolean {
  return (
    normalizePublicOrderRef(key) !== null ||
    normalizePublicOrderRefLoose(key) !== null
  );
}

export function resolvePublicOrderRefForLookup(
  raw: string,
): { canonical: string; digitSuffix: string } | null {
  const canonical =
    normalizePublicOrderRef(raw) ?? normalizePublicOrderRefLoose(raw);
  if (!canonical) return null;
  const digitSuffix = publicOrderRefNumericSuffix(canonical);
  if (!digitSuffix) return null;
  return { canonical, digitSuffix };
}

export function publicOrderRefsEquivalent(a: string, b: string): boolean {
  const na =
    normalizePublicOrderRef(a) ??
    normalizePublicOrderRefLoose(a);
  const nb =
    normalizePublicOrderRef(b) ??
    normalizePublicOrderRefLoose(b);
  if (na && nb) return na === nb;
  const sa = publicOrderRefNumericSuffix(na ?? a);
  const sb = publicOrderRefNumericSuffix(nb ?? b);
  return sa.length >= 3 && sa === sb;
}
