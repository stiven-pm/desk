import type { Env } from "../types";

export type OAuthProviderId = "google" | "hubspot" | "shopify";

export function oauthConfigured(
  env: Env,
  provider: OAuthProviderId,
): boolean {
  switch (provider) {
    case "google":
      return Boolean(
        env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
          env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
      );
    case "hubspot":
      return Boolean(
        env.HUBSPOT_OAUTH_CLIENT_ID?.trim() &&
          env.HUBSPOT_OAUTH_CLIENT_SECRET?.trim(),
      );
    case "shopify":
      return Boolean(
        env.SHOPIFY_OAUTH_CLIENT_ID?.trim() &&
          env.SHOPIFY_OAUTH_CLIENT_SECRET?.trim(),
      );
    default:
      return false;
  }
}

export function buildOAuthAuthorizeUrl(
  env: Env,
  provider: OAuthProviderId,
  state: string,
  redirectUri: string,
  extra?: { shop?: string },
): string {
  const enc = encodeURIComponent;
  switch (provider) {
    case "google": {
      const scope = enc(
        "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
      );
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${enc(env.GOOGLE_OAUTH_CLIENT_ID!)}&redirect_uri=${enc(redirectUri)}&response_type=code&scope=${scope}&state=${enc(state)}&access_type=offline&prompt=consent`;
    }
    case "hubspot": {
      const scope = enc("crm.objects.contacts.read crm.objects.deals.read");
      return `https://app.hubspot.com/oauth/authorize?client_id=${enc(env.HUBSPOT_OAUTH_CLIENT_ID!)}&redirect_uri=${enc(redirectUri)}&scope=${scope}&state=${enc(state)}`;
    }
    case "shopify": {
      const shop = (extra?.shop ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!shop) throw new Error("shop_required");
      return `https://${shop}/admin/oauth/authorize?client_id=${enc(env.SHOPIFY_OAUTH_CLIENT_ID!)}&scope=read_orders,read_products&redirect_uri=${enc(redirectUri)}&state=${enc(state)}`;
    }
    default:
      throw new Error("unknown_provider");
  }
}

export async function exchangeOAuthCode(
  env: Env,
  provider: OAuthProviderId,
  code: string,
  redirectUri: string,
  extra?: { shop?: string },
): Promise<Record<string, unknown>> {
  switch (provider) {
    case "google": {
      const body = new URLSearchParams({
        code,
        client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      return (await res.json()) as Record<string, unknown>;
    }
    case "hubspot": {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.HUBSPOT_OAUTH_CLIENT_ID!,
        client_secret: env.HUBSPOT_OAUTH_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
      });
      const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      return (await res.json()) as Record<string, unknown>;
    }
    case "shopify": {
      const shop = (extra?.shop ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      const body = new URLSearchParams({
        client_id: env.SHOPIFY_OAUTH_CLIENT_ID!,
        client_secret: env.SHOPIFY_OAUTH_CLIENT_SECRET!,
        code,
      });
      const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = (await res.json()) as Record<string, unknown>;
      return { ...data, shop };
    }
    default:
      throw new Error("unknown_provider");
  }
}

export function connectorKeyForProvider(provider: OAuthProviderId): string {
  switch (provider) {
    case "google":
      return "google_sheets";
    case "hubspot":
      return "hubspot";
    case "shopify":
      return "shopify";
  }
}

export function configFromTokenResponse(
  provider: OAuthProviderId,
  tokens: Record<string, unknown>,
): Record<string, unknown> {
  switch (provider) {
    case "google":
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    case "hubspot":
      return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
    case "shopify":
      return {
        accessToken: tokens.access_token,
        shop: tokens.shop,
      };
  }
}
