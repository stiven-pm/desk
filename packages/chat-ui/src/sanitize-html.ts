const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "a",
  "span",
  "div",
  "h3",
  "h4",
  "img",
]);

/** Sanitización conservadora para snippets generados (sin script/style/on*). */
export function sanitizeDeskHtml(raw: string, maxLen: number): string {
  let html = raw.slice(0, maxLen);
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/javascript:/gi, "");

  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag) => {
    const name = tag.match(/^<\/?([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
    if (!name || !ALLOWED_TAGS.has(name)) return "";
    if (name === "a" && /href\s*=\s*["']?\s*javascript/i.test(tag)) return "";
    if (name === "img") {
      if (!/src\s*=\s*["']https:\/\//i.test(tag)) return "";
      return tag.replace(/\s(width|height)\s*=\s*[^>\s]+/gi, "");
    }
    return tag.replace(/\s(class|href|src|alt|title)\s*=\s*("[^"]*"|'[^']*')/gi, (m) => {
      const val = m.split("=")[1]?.trim() ?? "";
      if (val.length > 200) return "";
      return m;
    });
  });
}
