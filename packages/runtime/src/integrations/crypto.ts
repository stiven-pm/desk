export async function encryptSecret(
  plaintext: string,
  encryptionKey: string,
): Promise<string> {
  const enc = new TextEncoder();
  const raw = enc.encode(encryptionKey.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
  return `v1:${ivB64}:${ctB64}`;
}

export async function decryptSecret(
  payload: string,
  encryptionKey: string,
): Promise<string | null> {
  if (!payload?.startsWith("v1:")) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const iv = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();
    const raw = enc.encode(encryptionKey.padEnd(32, "0").slice(0, 32));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
      "decrypt",
    ]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
