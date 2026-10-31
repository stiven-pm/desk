import { getJsonPath } from "./integration-capabilities";

function looksLikeWompiEvent(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const r = body as Record<string, unknown>;
  return Boolean(r.signature && r.data);
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Valida eventos Wompi (header X-Event-Checksum o signature.checksum). */
export async function verifyWompiEventChecksum(
  body: unknown,
  eventSecret: string,
  headerChecksum: string | null | undefined,
): Promise<boolean> {
  if (!looksLikeWompiEvent(body)) return false;
  const secret = eventSecret.trim();
  if (!secret) return false;

  const root = body as {
    data?: unknown;
    signature?: {
      properties?: string[];
      timestamp?: number;
      checksum?: string;
    };
  };
  const sig = root.signature;
  if (!sig?.properties?.length || sig.timestamp == null) return false;

  let concat = "";
  for (const prop of sig.properties) {
    const v = getJsonPath(root.data, prop);
    if (v === undefined || v === null) continue;
    concat += typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  concat += String(sig.timestamp);
  concat += secret;

  const digest = (await sha256Hex(concat)).toLowerCase();
  const expected = (headerChecksum ?? sig.checksum ?? "").trim().toLowerCase();
  return expected.length > 0 && digest === expected;
}

export { looksLikeWompiEvent };
