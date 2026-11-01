import type { CommerceBuyer } from "@chatbot/domain";
import type { AdvanceResult } from "./checkout-advance";
import type { LlmToolSchema } from "../integrations/types";

export const COMMERCE_FLOW_LLM_TOOL_NAMES = [
  "commerce_view_cart",
  "commerce_provide_buyer_fields",
  "commerce_set_fulfillment",
  "commerce_begin_payment",
] as const;

/** Hidden from the LLM when AGENT_FLOW_TOOLS is on. */
export const COMMERCE_LEGACY_FLOW_TOOL_NAMES = [
  "commerce_cart_get",
  "commerce_set_buyer",
  "commerce_start_checkout",
] as const;

export const COMMERCE_FLOW_LLM_TOOLS: LlmToolSchema[] = [
  {
    type: "function",
    function: {
      name: "commerce_view_cart",
      description:
        "Show the current cart when the visitor asks what they have, the total, or says cart. " +
        "Do not run catalog search in the same turn.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_provide_buyer_fields",
      description:
        "Save buyer data (one or many fields) and advance checkout. " +
        "Fields: name, email, phone, documentId, companyName, taxId, city, address, notes, type (natural_person|company).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["natural_person", "company"] },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          documentId: { type: "string" },
          companyName: { type: "string" },
          taxId: { type: "string" },
          city: { type: "string" },
          address: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_set_fulfillment",
      description:
        "Choose pickup or delivery when the funnel requires it. Moves toward payment.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["pickup", "delivery"] },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_begin_payment",
      description:
        "Start or retry payment (gateway link) when cart and buyer are ready. " +
        "Use when the visitor says pay or retry. turnstileToken only if the client sent one.",
      parameters: {
        type: "object",
        properties: {
          turnstileToken: { type: "string" },
          confirmPriceChange: { type: "boolean" },
          confirmCartChange: { type: "boolean" },
        },
      },
    },
  },
];

export function mergeBuyerFieldsFromArgs(
  prev: CommerceBuyer | null,
  args: Record<string, unknown>,
): CommerceBuyer {
  const type =
    args.type === "company" ? "company" : (prev?.type ?? "natural_person");
  const pick = (key: keyof CommerceBuyer) =>
    args[key] != null ? String(args[key]).trim() : prev?.[key];
  return {
    type,
    name: pick("name"),
    email: pick("email"),
    phone: pick("phone"),
    documentId: pick("documentId"),
    companyName: pick("companyName"),
    taxId: pick("taxId"),
    city: pick("city"),
    address: pick("address"),
    notes: pick("notes"),
  };
}

export function advanceResultToToolPayload(
  advance: AdvanceResult,
  flowPhase: string,
): Record<string, unknown> {
  switch (advance.step) {
    case "ask_fields":
      return {
        ok: true,
        step: advance.step,
        fields: advance.fields,
        flowPhase,
      };
    case "ask_consent":
      return { ok: true, step: advance.step, flowPhase };
    case "ask_fulfillment":
      return {
        ok: true,
        step: advance.step,
        options: advance.options,
        flowPhase,
      };
    case "confirm_price":
      return {
        ok: true,
        step: advance.step,
        totalFormatted: advance.totalFormatted,
        flowPhase,
        hint: "Ask the visitor to confirm the total or use the confirm-price button.",
      };
    case "link_ready":
      return {
        ok: true,
        step: advance.step,
        checkoutUrl: advance.checkoutUrl,
        flowPhase,
      };
    case "blocked":
      return {
        ok: false,
        step: advance.step,
        blocker: advance.blocker,
        retryable: advance.retryable,
        flowPhase,
      };
  }
}

export function isCommerceFlowToolName(name: string): boolean {
  return (COMMERCE_FLOW_LLM_TOOL_NAMES as readonly string[]).includes(name);
}
