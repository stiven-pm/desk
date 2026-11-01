import { DESK_AGENT_TOOL } from "@chatbot/domain";

const UUID_TOKEN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GLM_XML_COMMERCE_TOOL =
  /<tool_call>\s*([a-z_][a-z0-9_]*)[\s\S]*?<\/tool_call>/i;

/** GLM XML when native tool_calls are missing (incl. desk_visitor_message with text arg). */
export function parseGlmXmlCommerceToolCall(
  content: string,
  allowedToolNames: ReadonlySet<string>,
): { name: string; args: Record<string, unknown> } | null {
  const trimmed = content.trim();
  if (!/^<tool_call>/i.test(trimmed)) return null;
  const head = trimmed.match(GLM_XML_COMMERCE_TOOL);
  const name = head?.[1];
  if (!name || !allowedToolNames.has(name)) return null;
  const args: Record<string, unknown> = {};
  for (const arg of trimmed.matchAll(
    /<arg_key>\s*([^<]+)\s*<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/gi,
  )) {
    args[arg[1]!.trim()] = arg[2]!.trim();
  }
  if (name === DESK_AGENT_TOOL.visitorMessage) {
    const text = String(args.text ?? "").trim();
    return text ? { name, args: { text } } : null;
  }
  if (name === "commerce_get_product_details") {
    const productId = String(args.productId ?? "").trim();
    return productId ? { name, args: { productId } } : null;
  }
  if (name === "commerce_cart_add") {
    const productId = String(args.productId ?? "").trim();
    const quantity = Number.parseInt(String(args.quantity ?? ""), 10);
    const productName = String(args.name ?? "").trim();
    if (!productId || !productName || !Number.isFinite(quantity)) return null;
    return {
      name,
      args: {
        name: productName,
        productId,
        quantity,
        ...(args.lineNotes != null
          ? { lineNotes: String(args.lineNotes) }
          : {}),
      },
    };
  }
  if (Object.keys(args).length) return { name, args };
  return null;
}

/** GLM sometimes emits `commerce_cart_add …` as plain assistant text instead of tool_calls. */
export function parseCommerceToolProseLine(
  content: string,
  allowedToolNames: ReadonlySet<string>,
): { name: string; args: Record<string, unknown> } | null {
  const line = content.trim();
  if (!line || line.includes("\n")) return null;
  const space = line.indexOf(" ");
  const name = space < 0 ? line : line.slice(0, space);
  if (!allowedToolNames.has(name)) return null;
  const rest = space < 0 ? "" : line.slice(space + 1).trim();
  if (name === "commerce_get_product_details") {
    const productId =
      rest.match(UUID_TOKEN)?.[0] ?? (UUID_TOKEN.test(rest) ? rest : "");
    if (!productId) return null;
    return { name, args: { productId } };
  }
  if (name === "commerce_cart_add") {
    if (!rest) return null;
    const tokens = rest.split(/\s+/);
    if (tokens.length < 2) return null;
    const qty = Number.parseInt(tokens[tokens.length - 1]!, 10);
    if (!Number.isFinite(qty) || qty < 1) return null;
    const uuidIdx = tokens.findIndex((t) => UUID_TOKEN.test(t));
    if (uuidIdx < 0) return null;
    const productId = tokens[uuidIdx]!;
    const productName = tokens[0]?.trim() ?? "";
    const lineNoteParts = uuidIdx > 1 ? tokens.slice(1, uuidIdx) : [];
    if (!productName) return null;
    return {
      name,
      args: {
        name: productName,
        productId,
        quantity: qty,
        ...(lineNoteParts.length
          ? { lineNotes: lineNoteParts.join(" ") }
          : {}),
      },
    };
  }
  return null;
}

export function isCommerceToolProseLeak(
  content: string,
  allowedToolNames: ReadonlySet<string>,
): boolean {
  return (
    parseCommerceToolProseLine(content, allowedToolNames) != null ||
    parseGlmXmlCommerceToolCall(content, allowedToolNames) != null
  );
}
