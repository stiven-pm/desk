import type { DeskUiBlock, GenNode } from "./types";
import { parseAssistantUi } from "./parse";

const PLAIN_TEXT_MAX = 4096;

function formatMoney(cents: number, currency: string): string {
  const major = cents / 100;
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: currency.slice(0, 8) || "USD",
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${major} ${currency}`;
  }
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatGenNode(node: GenNode, depth = 0): string {
  if (node.t === "text") return node.v;
  if (node.t === "btn") return `• ${node.label}`;
  const kids = (node.children ?? []).map((c) => formatGenNode(c, depth + 1));
  return kids.filter(Boolean).join("\n");
}

function formatBlock(block: DeskUiBlock): string {
  switch (block.type) {
    case "products":
      return block.items
        .map((p) => {
          const price = p.price ? ` — ${p.price}` : "";
          const sub = p.subtitle ? `\n  ${p.subtitle}` : "";
          return `▸ ${p.title}${price}${sub}`;
        })
        .join("\n");
    case "offers":
      return block.items
        .map((o) => {
          const price = o.price ? ` — ${o.price}` : "";
          return `▸ ${o.title}${price}`;
        })
        .join("\n");
    case "cart": {
      const lines = block.lines.map(
        (l) =>
          `• ${l.quantity}× ${l.name} (${formatMoney(l.priceCents, block.currency)})`,
      );
      const subtotal = block.lines.reduce(
        (s, l) => s + l.priceCents * l.quantity,
        0,
      );
      lines.push(`Total: ${formatMoney(subtotal, block.currency)}`);
      return lines.join("\n");
    }
    case "choices":
      return block.items.map((c, i) => `${i + 1}. ${c.label}`).join("\n");
    case "quantity":
      return `Cantidad (${block.min ?? 1}–${block.max ?? 99})`;
    case "gen":
      return formatGenNode(block.root);
    case "html":
      return stripHtml(block.html);
    case "external_link":
      return block.label;
    case "host":
      return "(Contenido interactivo: pide al asesor el detalle en este chat.)";
    default:
      return "";
  }
}

/** Convierte respuesta del asistente (prosa + desk-ui) a texto plano. */
export function formatAssistantTextPlain(raw: string): string {
  const { prose, blocks } = parseAssistantUi(raw);
  const parts: string[] = [];
  if (prose.trim()) parts.push(prose.trim());
  for (const block of blocks) {
    const chunk = formatBlock(block).trim();
    if (chunk) parts.push(chunk);
  }
  let out = parts.join("\n\n").trim();
  if (!out) out = raw.replace(/```desk-ui[\s\S]*?```/gi, "").trim();
  if (out.length > PLAIN_TEXT_MAX) {
    out = `${out.slice(0, PLAIN_TEXT_MAX - 1)}…`;
  }
  return out;
}
