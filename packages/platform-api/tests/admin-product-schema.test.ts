import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Mirrors admin-commerce product patch schema (ZodEffects has no .partial()). */
const productImageUrlSchema = z.union([
  z.string().url().max(2048),
  z.literal(""),
]);

const productFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  promoLabel: z.string().max(80).nullable().optional(),
  currency: z.string().max(8).optional(),
  imageUrl: productImageUrlSchema.optional(),
  stockQty: z.number().int().min(0).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
});

function refineProductCompareAtPrice(
  d: { priceCents?: number; compareAtPriceCents?: number | null },
  ctx: z.RefinementCtx,
): void {
  if (d.compareAtPriceCents == null || d.priceCents == null) return;
  if (
    d.compareAtPriceCents > 0 &&
    d.compareAtPriceCents < d.priceCents
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "compare_at_must_be_gte_sale_price",
      path: ["compareAtPriceCents"],
    });
  }
}

const productPatchSchema = productFieldsSchema
  .partial()
  .superRefine(refineProductCompareAtPrice);

describe("productPatchSchema", () => {
  it("accepts dashboard save payload without throwing", () => {
    const parsed = productPatchSchema.safeParse({
      name: "snacks",
      priceCents: 2_000_000,
      compareAtPriceCents: null,
      promoLabel: null,
      imageUrl: "https://api-desk.rekov.co/v1/catalog-assets/org/file.jpg",
      stockQty: 45,
      currency: "COP",
      status: "published",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts status-only patch", () => {
    expect(
      productPatchSchema.safeParse({ status: "draft" }).success,
    ).toBe(true);
  });
});
