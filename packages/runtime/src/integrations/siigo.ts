/** Siigo API: JWT ~24h; usuario + access_key + Partner-Id no expiran — se re-autentica en /auth. */

export type SiigoAuthResult = {
  accessToken: string;
  expiresAt: number;
};

export async function siigoAuthenticate(params: {
  username: string;
  accessKey: string;
  partnerId: string;
}): Promise<SiigoAuthResult> {
  const res = await fetch("https://api.siigo.com/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Partner-Id": params.partnerId,
    },
    body: JSON.stringify({
      username: params.username,
      access_key: params.accessKey,
    }),
  });
  if (!res.ok) throw new Error("siigo_auth_failed");
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("siigo_auth_failed");
  const expiresAt = Date.now() + (data.expires_in ?? 86_400) * 1000;
  return { accessToken: data.access_token, expiresAt };
}

const REFRESH_BUFFER_MS = 10 * 60 * 1000;

export function siigoTokenNeedsRefresh(config: Record<string, unknown>): boolean {
  const expiresAt = Number(config.tokenExpiresAt ?? 0);
  if (!config.accessToken || !expiresAt) return true;
  return expiresAt - Date.now() < REFRESH_BUFFER_MS;
}
