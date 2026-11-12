import { orgServiceActive } from "@chatbot/domain";
import type { Env } from "../types";

export type PublicStorefrontProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  promoLabel: string | null;
  currency: string;
  imageUrl: string | null;
  stockQty: number | null;
  allowsAdditions: boolean;
};

export async function listPublishedProductsForOrgSlug(
  env: Env,
  orgSlug: string,
  limit = 100,
): Promise<
  | { ok: true; orgId: string; products: PublicStorefrontProduct[] }
  | { ok: false; error: "not_found" | "inactive" }
> {
  const org = await env.DB.prepare(
    `SELECT id, status, trial_ends_at FROM orgs WHERE slug = ?`,
  )
    .bind(orgSlug)
    .first<{ id: string; status: string; trial_ends_at: string | null }>();
  if (!org) return { ok: false, error: "not_found" };
  if (!orgServiceActive(org.status, org.trial_ends_at)) {
    return { ok: false, error: "inactive" };
  }

  const rows = await env.DB.prepare(
    `SELECT id, name, description, price_cents, compare_at_price_cents, promo_label,
            currency, image_url, stock_qty, allows_additions
     FROM products
     WHERE org_id = ? AND status = 'published'
     ORDER BY featured DESC, updated_at DESC
     LIMIT ?`,
  )
    .bind(org.id, limit)
    .all<{
      id: string;
      name: string;
      description: string | null;
      price_cents: number;
      compare_at_price_cents: number | null;
      promo_label: string | null;
      currency: string;
      image_url: string | null;
      stock_qty: number | null;
      allows_additions: number;
    }>();

  const products: PublicStorefrontProduct[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    priceCents: r.price_cents,
    compareAtPriceCents: r.compare_at_price_cents,
    promoLabel: r.promo_label,
    currency: r.currency,
    imageUrl: r.image_url,
    stockQty: r.stock_qty,
    allowsAdditions: Number(r.allows_additions) === 1,
  }));

  return { ok: true, orgId: org.id, products };
}
