export type CommerceBuyerType = "natural_person" | "company";

export type CommerceBuyer = {
  type: CommerceBuyerType;
  name?: string;
  email?: string;
  phone?: string;
  /** Cédula / documento de identidad (persona natural). */
  documentId?: string;
  companyName?: string;
  taxId?: string;
  city?: string;
  address?: string;
  notes?: string;
};

export type CommerceCartLine = {
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  quantity: number;
  imageUrl?: string;
  /** Adiciones / personalización (texto libre; extras de pago van como otros productos). */
  lineNotes?: string;
};

export type CommerceCart = {
  lines: CommerceCartLine[];
  currency: string;
  updatedAt: string;
};

export type CommerceOrderStatus =
  | "created"
  | "awaiting_payment"
  | "pending_verification"
  | "paid"
  | "fulfilled"
  | "pending_fulfillment"
  | "failed"
  | "cancelled";

export type CommerceMode = "order_only" | "checkout_link";

export type OrderFulfillmentMode = "pickup" | "delivery";

export type OrderFulfillment = {
  mode: OrderFulfillmentMode;
  fullName?: string;
  phone?: string;
  city?: string;
  address?: string;
  extra?: string;
  capturedAt: string;
};

export const COMMERCE_TOOL_NAMES = [
  "commerce_cart_add",
  "commerce_cart_update",
  "commerce_cart_get",
  "commerce_set_buyer",
  "commerce_submit_order",
  "commerce_start_checkout",
  "commerce_get_order",
  "commerce_search_products",
  "commerce_get_product_details",
  "commerce_get_payment_instructions",
  "commerce_submit_payment_evidence",
] as const;

export type CommerceToolName = (typeof COMMERCE_TOOL_NAMES)[number];

export const BUYER_REQUIRED: Record<CommerceBuyerType, string[]> = {
  natural_person: ["name", "documentId", "phone", "city", "address"],
  company: ["companyName", "taxId", "name", "phone", "city", "address"],
};

export function buyerFieldsForType(
  type: CommerceBuyerType,
  manifest?: { buyerFields?: { natural_person?: string[]; company?: string[] } } | null,
): string[] {
  const custom = manifest?.buyerFields?.[type];
  if (custom?.length) return custom.slice(0, 12);
  return BUYER_REQUIRED[type] ?? BUYER_REQUIRED.natural_person;
}

export function missingCommerceBuyerFields(
  buyer: CommerceBuyer | null | undefined,
  manifest?: { buyerFields?: { natural_person?: string[]; company?: string[] } } | null,
): string[] {
  const type = buyer?.type ?? "natural_person";
  const merged: CommerceBuyer = { type, ...(buyer ?? {}) };
  const required = buyerFieldsForType(type, manifest);
  return required.filter((field) => {
    const v = merged[field as keyof CommerceBuyer];
    return !v || !String(v).trim();
  });
}
