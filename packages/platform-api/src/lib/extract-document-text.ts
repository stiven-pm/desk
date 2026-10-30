import type { Env } from "../types";

function needsMarkdownConversion(
  contentType: string,
  filename: string,
): boolean {
  const ct = contentType.toLowerCase();
  if (
    ct.includes("pdf") ||
    ct.includes("wordprocessingml") ||
    ct.includes("msword") ||
    ct.includes("officedocument")
  ) {
    return true;
  }
  return /\.(pdf|docx?)$/i.test(filename);
}

/** Texto plano para indexar en Vectorize (PDF/DOCX vía Workers AI toMarkdown). */
export async function extractDocumentText(
  env: Env,
  obj: R2ObjectBody,
  filename: string,
): Promise<string> {
  const contentType =
    obj.httpMetadata?.contentType?.toLowerCase() ?? "application/octet-stream";
  const name = filename.trim() || "document";

  if (needsMarkdownConversion(contentType, name)) {
    try {
      const blob = new Blob([await obj.arrayBuffer()], {
        type: contentType,
      });
      const res = await env.AI.toMarkdown({ name, blob });
      if (res.format === "markdown" && res.data.trim()) {
        return res.data;
      }
      if (res.format === "error") {
        console.error("toMarkdown_failed", name, res.error);
      }
    } catch (e) {
      console.error("toMarkdown_exception", name, e);
    }
  }

  return await obj.text();
}
