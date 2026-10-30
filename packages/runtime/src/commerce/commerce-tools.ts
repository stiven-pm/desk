import type { CommerceBuyer } from "@chatbot/domain";
import type { LlmToolSchema } from "../integrations/types";
import type { CommerceService } from "./commerce-service";
import { formatCartForPrompt } from "./cart-store";
import { nativeProductToToolJson } from "./native-catalog";

const COMMERCE_TOOL_DEFINITIONS: LlmToolSchema[] = [
  {
    type: "function",
    function: {
      name: "commerce_search_products",
      description:
        "Nodo explorar_catálogo / acotar_búsqueda / volver_a_oferta. Busca productos publicados por texto (nombre, categoría, términos inferidos del visitante). " +
        "Devuelve ids, nombres, precios y stock — invócala antes de mostrar oferta al visitante; el runtime adjunta product_catalog tras search. " +
        "Query vacía: destacados/recientes. Si ambiguo, pregunta antes de cart_add.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Términos del visitante; cadena vacía solo si pide ver todo el catálogo.",
          },
          limit: { type: "integer", description: "Máximo de resultados (default 12)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_get_product_details",
      description:
        "Nodo producto_único / detalle_y_cantidad. Detalle por productId (precio, stock, allows_additions). " +
        "Úsala tras search cuando el visitante elige uno o antes de pedir cantidad/notas.",
      parameters: {
        type: "object",
        properties: { productId: { type: "string" } },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_cart_get",
      description:
        "Lee el carrito actual (líneas, cantidades, productId). " +
        "Úsala cuando pregunte qué lleva, total, o antes de quitar/cambiar cantidades.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_cart_add",
      description:
        "Nodo añadir_carrito. Suma unidades; requiere productId y name de search/details. " +
        "Pide quantity (1–99) y lineNotes si el producto es personalizable. Espera respuesta del visitante si falta algo.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string" },
          name: { type: "string" },
          priceCents: {
            type: "integer",
            description:
              "Solo si no hay catálogo conectado; con catálogo nativo el servidor fija el precio.",
          },
          quantity: {
            type: "integer",
            description: "Unidades a sumar (1–99). Obligatorio si el visitante ya indicó cantidad.",
          },
          lineNotes: {
            type: "string",
            description:
              "Adiciones o nota del ítem cuando el producto es personalizable (allows_additions).",
          },
          currency: { type: "string" },
          imageUrl: { type: "string" },
        },
        required: ["productId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_cart_update",
      description:
        "Fija la cantidad de una línea del carrito (productId del carrito). quantity 0 elimina la línea. " +
        "Úsala cuando pida quitar, reducir, dejar en N unidades, vaciar un producto, etc. " +
        "Si hay varias líneas o no está claro el producto, llama commerce_cart_get y pregunta cuál.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string" },
          quantity: {
            type: "integer",
            description: "Cantidad final deseada para esa línea (0 = quitar).",
          },
        },
        required: ["productId", "quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_set_buyer",
      description:
        "Guarda datos del comprador (natural_person o company). Campos: name, email, phone, documentId, city, address, companyName, taxId, notes.",
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
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_start_checkout",
      description:
        "Genera el pedido y URL de pago cuando el carrito está listo y el comprador cumple requisitos. " +
        "No sustituye explicar el total; usa commerce_cart_get antes si hace falta.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_get_order",
      description: "Consulta el último pedido o uno por orderId.",
      parameters: {
        type: "object",
        properties: { orderId: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commerce_get_payment_status",
      description:
        "Consulta el estado de un pago en la pasarela (referencia public_ref o externalId).",
      parameters: {
        type: "object",
        properties: {
          reference: { type: "string" },
        },
        required: ["reference"],
      },
    },
  },
];

/** Tools exposed to the LLM (evidence upload is UI-only on /o/{ref}). */
export const COMMERCE_LLM_TOOLS: LlmToolSchema[] = COMMERCE_TOOL_DEFINITIONS.filter(
  (t) => t.function.name !== "commerce_submit_payment_evidence",
);

export function isCommerceToolName(name: string): boolean {
  return COMMERCE_TOOL_DEFINITIONS.some((t) => t.function.name === name);
}

export async function executeCommerceTool(
  svc: CommerceService,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "commerce_cart_add": {
      const added = await svc.cartAdd({
        productId: String(args.productId ?? ""),
        name: String(args.name ?? ""),
        priceCents:
          args.priceCents != null ? Number(args.priceCents) : undefined,
        quantity: args.quantity != null ? Number(args.quantity) : undefined,
        currency: args.currency != null ? String(args.currency) : undefined,
        imageUrl: args.imageUrl != null ? String(args.imageUrl) : undefined,
        lineNotes:
          args.lineNotes != null ? String(args.lineNotes).slice(0, 400) : undefined,
      });
      if (!added.ok) {
        return JSON.stringify(added);
      }
      return JSON.stringify({
        ok: true,
        cart: added.cart,
        summary: formatCartForPrompt(added.cart),
      });
    }
    case "commerce_cart_update": {
      const cart = await svc.cartUpdate(
        String(args.productId ?? ""),
        Number(args.quantity ?? 0),
      );
      return JSON.stringify({ ok: true, cart, summary: formatCartForPrompt(cart) });
    }
    case "commerce_cart_get":
      return JSON.stringify({
        ok: true,
        cart: svc.getCart(),
        summary: formatCartForPrompt(svc.getCart()),
      });
    case "commerce_set_buyer": {
      const prev = svc.getBuyer() ?? { type: "natural_person" as const };
      const buyerType =
        args.type === "company" ? "company" : "natural_person";
      const buyer: CommerceBuyer = {
        ...prev,
        name: args.name != null ? String(args.name) : prev.name,
        email: args.email != null ? String(args.email) : prev.email,
        phone: args.phone != null ? String(args.phone) : prev.phone,
        documentId:
          args.documentId != null ? String(args.documentId) : prev.documentId,
        companyName:
          args.companyName != null ? String(args.companyName) : prev.companyName,
        taxId: args.taxId != null ? String(args.taxId) : prev.taxId,
        city: args.city != null ? String(args.city) : prev.city,
        address: args.address != null ? String(args.address) : prev.address,
        notes: args.notes != null ? String(args.notes) : prev.notes,
        type: buyerType,
      };
      svc.setBuyer(buyer);
      const valid = svc.validateBuyer(buyer);
      return JSON.stringify({ ok: true, buyer, valid });
    }
    case "commerce_submit_order":
      return JSON.stringify({
        ok: false,
        code: "use_commerce_start_checkout",
        hint: "Usa commerce_start_checkout para generar el link de pasarela.",
      });
    case "commerce_start_checkout": {
      const result = await svc.startCheckout();
      return JSON.stringify(result);
    }
    case "commerce_search_products": {
      const rows = await svc.searchProducts(String(args.query ?? ""));
      return JSON.stringify({
        ok: true,
        products: rows.map((r) => nativeProductToToolJson(r)),
      });
    }
    case "commerce_get_product_details": {
      const product = await svc.getProductDetails(String(args.productId ?? ""));
      return JSON.stringify({
        ok: Boolean(product),
        product: product ? nativeProductToToolJson(product) : null,
      });
    }
    case "commerce_get_payment_instructions":
    case "commerce_submit_payment_evidence":
      return JSON.stringify({ ok: false, code: "gateway_only_checkout" });
    case "commerce_get_order": {
      const order = await svc.getOrder(
        args.orderId != null ? String(args.orderId) : undefined,
      );
      return JSON.stringify({ ok: Boolean(order), order });
    }
    case "commerce_get_payment_status": {
      const status = await svc.getPaymentStatus(String(args.reference ?? ""));
      return JSON.stringify(status);
    }
    default:
      return JSON.stringify({ error: "unknown_commerce_tool" });
  }
}
