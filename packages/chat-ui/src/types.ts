export type ProductItem = {
  id?: string;
  title: string;
  subtitle?: string;
  price?: string;
  compareAtPrice?: string;
  badge?: string;
  imageUrl?: string;
  prompt?: string;
};

export type ChoiceItem = { label: string; message: string };

export type CartLineItem = {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
};

export type OfferItem = {
  id?: string;
  title: string;
  subtitle?: string;
  price?: string;
  compareAtPrice?: string;
  badge?: string;
  imageUrl?: string;
  intent: "continue" | "pay" | "human";
  message?: string;
  payload?: Record<string, unknown>;
};

/** Árbol UI acotado (no ejecuta JS del sitio; clases limitadas). */
export type GenNode =
  | { t: "text"; v: string }
  | { t: "btn"; label: string; message: string }
  | { t: "stack" | "row"; children: GenNode[]; class?: string };

export type DeskUiBlock =
  | { type: "products"; items: ProductItem[] }
  | {
      type: "product_catalog";
      buttonLabel: string;
      items: ProductItem[];
    }
  | { type: "offers"; items: OfferItem[] }
  | { type: "cart"; currency: string; lines: CartLineItem[] }
  | {
      type: "quantity";
      productId: string;
      min?: number;
      max?: number;
    }
  | { type: "choices"; items: ChoiceItem[] }
  | { type: "gen"; root: GenNode }
  | { type: "html"; html: string }
  | {
      type: "host";
      /** ID registrado en la web del cliente (DeskHost.register). */
      component: string;
      props?: Record<string, unknown>;
    };

export type DeskUiPayload = { blocks?: DeskUiBlock[] };

export type ParsedAssistantUi = {
  prose: string;
  blocks: DeskUiBlock[];
};

export const DESK_UI_FENCE = "desk-ui";
export const MAX_UI_BLOCKS = 5;
export const MAX_HTML_CHARS = 6_000;
