export function generateApiKey(kind: "publishable" | "secret"): {
  token: string;
  prefix: string;
} {
  const prefix = kind === "publishable" ? "cb_pub_" : "cb_sec_";
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const body = btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { token: `${prefix}${body}`, prefix };
}

export async function hashApiKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPublishableKey(token: string): boolean {
  return token.startsWith("cb_pub_");
}

export function isSecretKey(token: string): boolean {
  return token.startsWith("cb_sec_");
}
