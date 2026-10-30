import { siigoAuthenticate } from "@chatbot/runtime/integrations/siigo";

export async function enrichConnectorConfig(
  connectorKey: string,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (connectorKey === "siigo") {
    const username = String(config.username ?? "").trim();
    const accessKey = String(config.accessKey ?? "").trim();
    const partnerId = String(config.partnerId ?? "").trim();
    if (!username || !accessKey || !partnerId) {
      throw new Error("siigo_credentials_incomplete");
    }
    const { accessToken, expiresAt } = await siigoAuthenticate({
      username,
      accessKey,
      partnerId,
    });
    return {
      ...config,
      username,
      accessKey,
      accessToken,
      tokenExpiresAt: expiresAt,
      partnerId,
    };
  }

  if (connectorKey === "hubspot") {
    const accessToken = String(config.accessToken ?? "").trim();
    if (!accessToken) throw new Error("hubspot_token_required");
    return { ...config, accessToken };
  }

  if (connectorKey === "google_sheets") {
    const spreadsheetId = String(config.spreadsheetId ?? "").trim();
    if (!spreadsheetId) throw new Error("spreadsheet_id_required");
    const apiKey = config.apiKey ? String(config.apiKey).trim() : "";
    const accessToken = config.accessToken ? String(config.accessToken).trim() : "";
    if (!apiKey && !accessToken) throw new Error("sheets_auth_required");
    return {
      ...config,
      spreadsheetId,
      range: String(config.range ?? "A1:Z200"),
      apiKey: apiKey || undefined,
      accessToken: accessToken || undefined,
    };
  }

  if (connectorKey === "shopify") {
    const shop = String(config.shop ?? "").trim();
    const accessToken = String(config.accessToken ?? "").trim();
    if (!shop || !accessToken) throw new Error("shopify_credentials_incomplete");
    return { ...config, shop, accessToken };
  }

  if (connectorKey === "woocommerce") {
    const siteUrl = String(config.siteUrl ?? "").trim().replace(/\/$/, "");
    const consumerKey = String(config.consumerKey ?? "").trim();
    const consumerSecret = String(config.consumerSecret ?? "").trim();
    if (!siteUrl || !consumerKey || !consumerSecret) {
      throw new Error("woocommerce_credentials_incomplete");
    }
    return { ...config, siteUrl, consumerKey, consumerSecret };
  }

  if (connectorKey === "odoo") {
    const baseUrl = String(config.baseUrl ?? "").trim().replace(/\/$/, "");
    const apiKey = String(config.apiKey ?? "").trim();
    if (!baseUrl || !apiKey) throw new Error("odoo_credentials_incomplete");
    return {
      ...config,
      baseUrl,
      apiKey,
      database: String(config.database ?? "").trim() || undefined,
    };
  }

  if (connectorKey === "alegra") {
    const email = String(config.email ?? "").trim();
    const token = String(config.token ?? "").trim();
    if (!email || !token) throw new Error("alegra_credentials_incomplete");
    return { ...config, email, token };
  }

  if (connectorKey === "zendesk") {
    const subdomain = String(config.subdomain ?? "").trim();
    const email = String(config.email ?? "").trim();
    const apiToken = String(config.apiToken ?? "").trim();
    if (!subdomain || !email || !apiToken) {
      throw new Error("zendesk_credentials_incomplete");
    }
    return { ...config, subdomain, email, apiToken };
  }

  if (connectorKey === "supabase") {
    const projectUrl = String(config.projectUrl ?? "").trim().replace(/\/$/, "");
    const apiKey = String(config.apiKey ?? "").trim();
    if (!projectUrl || !apiKey) throw new Error("supabase_credentials_incomplete");
    return { ...config, projectUrl, apiKey };
  }

  if (connectorKey === "postgres_proxy") {
    const proxyUrl = String(config.proxyUrl ?? "").trim().replace(/\/$/, "");
    if (!proxyUrl) throw new Error("postgres_proxy_url_required");
    return {
      ...config,
      proxyUrl,
      proxyToken: config.proxyToken ? String(config.proxyToken).trim() : undefined,
    };
  }

  return config;
}
