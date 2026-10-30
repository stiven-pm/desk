import { z } from "zod";
import { MAX_HTML_CHARS, MAX_UI_BLOCKS } from "./types";

const httpsUrl = z.string().url().max(2048).refine((u) => u.startsWith("https://"), {
  message: "https_only",
});

export const productItemSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  price: z.string().max(64).optional(),
  compareAtPrice: z.string().max(64).optional(),
  badge: z.string().max(40).optional(),
  imageUrl: httpsUrl.optional(),
  prompt: z.string().max(500).optional(),
});

export const offerItemSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  price: z.string().max(64).optional(),
  compareAtPrice: z.string().max(64).optional(),
  badge: z.string().max(40).optional(),
  imageUrl: httpsUrl.optional(),
  /** Cómo debe reaccionar la web del cliente (no checkout integrado en Desk). */
  intent: z.enum(["continue", "pay", "human"]),
  message: z.string().max(500).optional(),
  payload: z.record(z.unknown()).optional(),
});

export const choiceItemSchema = z.object({
  label: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
});

export const cartLineItemSchema = z.object({
  productId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  priceCents: z.number().int().min(0).max(999_999_999),
  quantity: z.number().int().min(1).max(99),
  imageUrl: httpsUrl.optional(),
});

const genNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ t: z.literal("text"), v: z.string().max(2000) }),
    z.object({
      t: z.literal("btn"),
      label: z.string().max(80),
      message: z.string().max(500),
    }),
    z.object({
      t: z.union([z.literal("stack"), z.literal("row")]),
      class: z.string().max(120).optional(),
      children: z.array(genNodeSchema).max(12),
    }),
  ]),
);

export const deskUiBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("products"),
    items: z.array(productItemSchema).min(1).max(6),
  }),
  z.object({
    type: z.literal("product_catalog"),
    buttonLabel: z.string().min(1).max(80).optional(),
    items: z.array(productItemSchema).min(1).max(24),
  }),
  z.object({
    type: z.literal("offers"),
    items: z.array(offerItemSchema).min(1).max(6),
  }),
  z.object({
    type: z.literal("choices"),
    items: z.array(choiceItemSchema).min(1).max(4),
  }),
  z.object({
    type: z.literal("quantity"),
    productId: z.string().min(1).max(64),
    min: z.number().int().min(1).max(99).optional(),
    max: z.number().int().min(1).max(99).optional(),
  }),
  z.object({
    type: z.literal("cart"),
    currency: z.string().max(8).default("USD"),
    lines: z.array(cartLineItemSchema).min(1).max(32),
  }),
  z.object({
    type: z.literal("gen"),
    root: genNodeSchema,
  }),
  z.object({
    type: z.literal("html"),
    html: z.string().max(MAX_HTML_CHARS),
  }),
  z.object({
    type: z.literal("host"),
    component: z.string().min(1).max(64),
    props: z.record(z.unknown()).optional(),
  }),
]);

export const deskUiPayloadSchema = z.object({
  blocks: z.array(deskUiBlockSchema).max(MAX_UI_BLOCKS).optional(),
});
