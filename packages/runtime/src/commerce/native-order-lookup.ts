import {
  extractPublicOrderRefFromText,
  normalizeDocumentDigits,
  normalizeEmailAddress,
  normalizeNativeOrderLookupFields,
  normalizePhoneDigits,
  normalizePublicOrderRefLoose,
  normalizeTaxIdDigits,
} from "@chatbot/domain";

export type NativeOrderLookupInput = {
  publicRef?: string;
  orderUuid?: string;
  phone?: string;
  documentId?: string;
  taxId?: string;
  email?: string;
  customerName?: string;
  /** Set by the model on commerce_get_order — matched against summary/lines/date. */
  orderHint?: string;
};

type BuyerFields = {
  name?: string;
  phone?: string;
  documentId?: string;
  email?: string;
  taxId?: string;
  companyName?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

export function parseBuyerJson(raw: string): BuyerFields | null {
  try {
    return JSON.parse(raw) as BuyerFields;
  } catch {
    return null;
  }
}

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function preserveOrderHint(
  source: NativeOrderLookupInput,
  normalized: NativeOrderLookupInput,
): NativeOrderLookupInput {
  const hint = source.orderHint?.trim();
  if (hint) normalized.orderHint = hint;
  return normalized;
}

/** Normalizes tool args from the model (not visitor regex). */
export function finalizeNativeOrderLookupInput(
  input: NativeOrderLookupInput,
): NativeOrderLookupInput {
  return preserveOrderHint(input, normalizeNativeOrderLookupFields(input));
}

/** Merge commerce_get_order arguments from the model into a D1 lookup query. */
export function mergeNativeOrderLookup(
  orderId?: string,
  opts?: Partial<NativeOrderLookupInput>,
): NativeOrderLookupInput {
  const merged: NativeOrderLookupInput = { ...(opts ?? {}) };
  const fromId = orderId?.trim() ?? "";
  if (fromId) {
    const ref =
      extractPublicOrderRefFromText(fromId) ??
      normalizePublicOrderRefLoose(fromId);
    if (ref) merged.publicRef = ref;
    else if (UUID_RE.test(fromId)) merged.orderUuid = fromId.toLowerCase();
  }
  if (opts?.phone) merged.phone = normalizePhoneDigits(opts.phone);
  if (opts?.documentId) {
    merged.documentId = normalizeDocumentDigits(opts.documentId);
  }
  if (opts?.taxId) merged.taxId = normalizeTaxIdDigits(opts.taxId);
  if (opts?.email) merged.email = normalizeEmailAddress(opts.email);
  if (opts?.customerName) merged.customerName = opts.customerName.trim();
  if (opts?.orderHint) merged.orderHint = opts.orderHint.trim();
  return finalizeNativeOrderLookupInput(merged);
}

export function buyerMatchesPhone(buyer: BuyerFields, phoneDigits: string): boolean {
  const p = normalizePhoneDigits(buyer.phone ?? "");
  if (!p) return false;
  if (p === phoneDigits) return true;
  if (p.length >= 7 && phoneDigits.endsWith(p)) return true;
  if (phoneDigits.length >= 7 && p.endsWith(phoneDigits)) return true;
  return false;
}

export function buyerMatchesDocument(
  buyer: BuyerFields,
  documentDigits: string,
): boolean {
  const d = normalizeDocumentDigits(buyer.documentId ?? "");
  return d.length >= 6 && d === documentDigits;
}

export function buyerMatchesTaxId(buyer: BuyerFields, taxDigits: string): boolean {
  const t = normalizeTaxIdDigits(buyer.taxId ?? "");
  return t.length >= 6 && t === taxDigits;
}

export function buyerMatchesEmail(buyer: BuyerFields, email: string): boolean {
  const e = normalizeEmailAddress(buyer.email ?? "");
  return e.length > 3 && e === normalizeEmailAddress(email);
}

export function buyerMatchesName(buyer: BuyerFields, name: string): boolean {
  const q = normalizeText(name);
  if (q.length < 3) return false;
  const candidates = [buyer.name, buyer.companyName]
    .filter(Boolean)
    .map((s) => normalizeText(String(s)));
  return candidates.some((c) => c.includes(q) || q.includes(c));
}

function normalizeProductToken(token: string): string {
  const n = normalizeText(token);
  if (/costill|coatill/.test(n)) return "costill";
  return n;
}

function orderRowMatchesDateInHint(row: OrderRow, hint: string): boolean {
  const created = String(row.created_at ?? "");
  if (!created) return false;
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return false;
  const h = normalizeText(hint);
  const verbal = h.match(
    /(\d{1,2})\s*de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/,
  );
  if (verbal) {
    const day = Number(verbal[1]);
    const month = SPANISH_MONTHS[verbal[2]] ?? -1;
    if (month >= 0 && d.getDate() === day && d.getMonth() === month) {
      return true;
    }
  }
  const slash = h.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    if (d.getDate() === day && d.getMonth() === month) return true;
  }
  return false;
}

function orderRowMatchesHint(row: OrderRow, hint: string): boolean {
  const q = normalizeText(hint);
  if (q.length < 3) return false;
  const summary = normalizeText(String(row.summary ?? ""));
  const lines = normalizeText(String(row.lines_json ?? ""));
  const blob = `${summary} ${lines}`;
  const blobNorm = blob.split(/\s+/).map(normalizeProductToken).join(" ");
  const qNorm = q.split(/\s+/).map(normalizeProductToken).join(" ");
  if (blobNorm.includes(qNorm) || blob.includes(q)) return true;
  const tokens = qNorm.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const hit = tokens.filter((t) => blobNorm.includes(t)).length;
  if (hit >= Math.min(2, tokens.length)) return true;
  if (orderRowMatchesDateInHint(row, hint) && hit >= 1) return true;
  if (orderRowMatchesDateInHint(row, hint) && tokens.length <= 2) return true;
  return orderRowMatchesDateInHint(row, hint);
}

function buyerFieldsMatch(row: OrderRow, input: NativeOrderLookupInput): boolean {
  const buyerRaw = row.buyer_json;
  if (typeof buyerRaw !== "string") return false;
  const buyer = parseBuyerJson(buyerRaw);
  if (!buyer) return false;
  if (input.documentId && buyerMatchesDocument(buyer, input.documentId)) {
    return true;
  }
  if (input.taxId && buyerMatchesTaxId(buyer, input.taxId)) return true;
  if (input.email && buyerMatchesEmail(buyer, input.email)) return true;
  if (input.customerName && buyerMatchesName(buyer, input.customerName)) {
    return true;
  }
  if (input.phone && buyerMatchesPhone(buyer, input.phone)) return true;
  return false;
}

export type OrderRow = Record<string, unknown>;

export function findOrderInRecentByBuyer(
  rows: OrderRow[],
  input: NativeOrderLookupInput,
): OrderRow | null {
  const hint = input.orderHint?.trim();
  const hasBuyerSignal = Boolean(
    input.documentId ||
      input.taxId ||
      input.email ||
      input.customerName ||
      input.phone,
  );

  for (const row of rows) {
    if (hasBuyerSignal && buyerFieldsMatch(row, input)) return row;
  }

  if (hint) {
    for (const row of rows) {
      if (!orderRowMatchesHint(row, hint)) continue;
      if (!hasBuyerSignal) return row;
      if (buyerFieldsMatch(row, input)) return row;
    }
  }

  return null;
}

export function countOrderMatchesInRecentByBuyer(
  rows: OrderRow[],
  input: NativeOrderLookupInput,
): number {
  let n = 0;
  for (const row of rows) {
    if (buyerFieldsMatch(row, input)) n += 1;
  }
  return n;
}
