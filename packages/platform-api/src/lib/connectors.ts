import type { ToolParameter } from "@chatbot/runtime/integrations/types";
import { encryptSecret } from "./crypto";
import { randomId } from "./http";

type ConnectorToolDef = {
  name: string;
  description: string;
  method: string;
  path: string;
  baseUrl: string;
  parameters: ToolParameter[];
  authType: "none" | "bearer" | "header";
  authHeaderName?: string;
  authSecret?: string;
  extraHeaders?: Record<string, string>;
};

export function materializeConnectorTools(
  connectorKey: string,
  config: Record<string, unknown>,
): ConnectorToolDef[] {
  switch (connectorKey) {
    case "custom_rest": {
      const baseUrl = String(config.baseUrl ?? "");
      const tools = (config.tools as ConnectorToolDef[] | undefined) ?? [];
      return tools.map((t) => ({
        ...t,
        baseUrl: t.baseUrl || baseUrl,
        authType: (config.authType as ConnectorToolDef["authType"]) ?? "bearer",
        authSecret: config.authSecret ? String(config.authSecret) : undefined,
      }));
    }
    case "google_sheets": {
      const token = String(config.accessToken ?? config.apiKey ?? "");
      const spreadsheetId = String(config.spreadsheetId ?? "");
      const range = String(config.range ?? "A1:Z100");
      if (!spreadsheetId || !token) return [];
      const useKey = Boolean(config.apiKey && !config.accessToken);
      return [
        {
          name: "get_sheet_range",
          description: `Lee el rango ${range} de la hoja de cálculo`,
          method: "GET",
          baseUrl: "https://sheets.googleapis.com",
          path: useKey
            ? `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(token)}`
            : `/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
          parameters: [],
          authType: useKey ? "none" : "bearer",
          authSecret: useKey ? undefined : token,
        },
      ];
    }
    case "hubspot": {
      const token = String(config.accessToken ?? config.apiKey ?? "");
      if (!token) return [];
      return [
        {
          name: "hubspot_search_contacts",
          description: "Busca contactos en HubSpot por email o texto",
          method: "POST",
          baseUrl: "https://api.hubapi.com",
          path: "/crm/v3/objects/contacts/search",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: { type: "object" },
            },
          ],
          authType: "bearer",
          authSecret: token,
        },
        {
          name: "hubspot_get_contact",
          description: "Obtiene un contacto HubSpot por ID (path contactId)",
          method: "GET",
          baseUrl: "https://api.hubapi.com",
          path: "/crm/v3/objects/contacts/{contactId}",
          parameters: [
            { name: "contactId", in: "path", required: true },
            { name: "properties", in: "query", required: false },
          ],
          authType: "bearer",
          authSecret: token,
        },
        {
          name: "hubspot_search_deals",
          description: "Busca negocios (deals) en HubSpot",
          method: "POST",
          baseUrl: "https://api.hubapi.com",
          path: "/crm/v3/objects/deals/search",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: { type: "object" },
            },
          ],
          authType: "bearer",
          authSecret: token,
        },
      ];
    }
    case "siigo": {
      const token = String(config.accessToken ?? "");
      const partnerId = String(config.partnerId ?? "");
      if (!token || !partnerId) return [];
      return [
        {
          name: "siigo_search_customers",
          description:
            "Busca clientes en Siigo (identificación en query identification)",
          method: "GET",
          baseUrl: "https://api.siigo.com",
          path: "/v1/customers",
          parameters: [
            { name: "identification", in: "query", required: false },
          ],
          authType: "bearer",
          authSecret: token,
          extraHeaders: { "Partner-Id": partnerId },
        },
        {
          name: "siigo_list_products",
          description:
            "Lista productos en Siigo (paginación: page, page_size). Útil para recomendar ítems con stock/precio.",
          method: "GET",
          baseUrl: "https://api.siigo.com",
          path: "/v1/products",
          parameters: [
            { name: "page", in: "query", required: false },
            { name: "page_size", in: "query", required: false },
          ],
          authType: "bearer",
          authSecret: token,
          extraHeaders: { "Partner-Id": partnerId },
        },
        {
          name: "siigo_get_invoice",
          description: "Obtiene una factura de venta en Siigo por ID (path id)",
          method: "GET",
          baseUrl: "https://api.siigo.com",
          path: "/v1/invoices/{id}",
          parameters: [{ name: "id", in: "path", required: true }],
          authType: "bearer",
          authSecret: token,
          extraHeaders: { "Partner-Id": partnerId },
        },
        {
          name: "siigo_list_invoices",
          description:
            "Lista facturas de venta en Siigo (paginación: page, page_size; filtro identification en query)",
          method: "GET",
          baseUrl: "https://api.siigo.com",
          path: "/v1/invoices",
          parameters: [
            { name: "page", in: "query", required: false },
            { name: "page_size", in: "query", required: false },
            { name: "identification", in: "query", required: false },
          ],
          authType: "bearer",
          authSecret: token,
          extraHeaders: { "Partner-Id": partnerId },
        },
      ];
    }
    case "alegra": {
      const token = String(config.token ?? "");
      const email = String(config.email ?? "");
      if (!token || !email) return [];
      const basic = btoa(`${email}:${token}`);
      return [
        {
          name: "alegra_list_contacts",
          description: "Lista contactos en Alegra",
          method: "GET",
          baseUrl: "https://api.alegra.com",
          path: "/api/v1/contacts",
          parameters: [],
          authType: "header",
          authHeaderName: "Authorization",
          authSecret: `Basic ${basic}`,
          extraHeaders: { Accept: "application/json" },
        },
        {
          name: "alegra_list_items",
          description: "Lista ítems / productos en Alegra",
          method: "GET",
          baseUrl: "https://api.alegra.com",
          path: "/api/v1/items",
          parameters: [
            { name: "start", in: "query", required: false },
            { name: "limit", in: "query", required: false },
          ],
          authType: "header",
          authHeaderName: "Authorization",
          authSecret: `Basic ${basic}`,
          extraHeaders: { Accept: "application/json" },
        },
        {
          name: "alegra_get_invoice",
          description: "Obtiene una factura en Alegra por ID (path id)",
          method: "GET",
          baseUrl: "https://api.alegra.com",
          path: "/api/v1/invoices/{id}",
          parameters: [{ name: "id", in: "path", required: true }],
          authType: "header",
          authHeaderName: "Authorization",
          authSecret: `Basic ${basic}`,
          extraHeaders: { Accept: "application/json" },
        },
      ];
    }
    case "odoo": {
      const baseUrl = String(config.baseUrl ?? "").replace(/\/$/, "");
      const apiKey = String(config.apiKey ?? "");
      const database = String(config.database ?? "").trim();
      if (!baseUrl || !apiKey) return [];
      const headers: Record<string, string> = {};
      if (database) headers["X-Odoo-Database"] = database;
      return [
        {
          name: "odoo_search_partners",
          description: "Busca contactos/empresas en Odoo",
          method: "POST",
          baseUrl,
          path: "/json/2/res.partner/search_read",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: {
                type: "object",
                properties: {
                  domain: { type: "array" },
                  fields: { type: "array" },
                  limit: { type: "number" },
                },
              },
            },
          ],
          authType: "bearer",
          authSecret: apiKey,
          extraHeaders: headers,
        },
        {
          name: "odoo_search_products",
          description: "Busca productos en Odoo (variantes product.product)",
          method: "POST",
          baseUrl,
          path: "/json/2/product.product/search_read",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: {
                type: "object",
                properties: {
                  domain: { type: "array" },
                  fields: { type: "array" },
                  limit: { type: "number" },
                },
              },
            },
          ],
          authType: "bearer",
          authSecret: apiKey,
          extraHeaders: headers,
        },
      ];
    }
    case "woocommerce": {
      const site = String(config.siteUrl ?? "").replace(/\/$/, "");
      const ck = String(config.consumerKey ?? "");
      const cs = String(config.consumerSecret ?? "");
      if (!site || !ck || !cs) return [];
      const q = `consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`;
      return [
        {
          name: "woocommerce_get_order",
          description: "Obtiene un pedido WooCommerce por ID",
          method: "GET",
          baseUrl: site,
          path: `/wp-json/wc/v3/orders/{orderId}?${q}`,
          parameters: [{ name: "orderId", in: "path", required: true }],
          authType: "none",
        },
        {
          name: "woocommerce_list_products",
          description: "Lista productos WooCommerce (paginación: page, per_page, search)",
          method: "GET",
          baseUrl: site,
          path: `/wp-json/wc/v3/products?${q}`,
          parameters: [
            { name: "page", in: "query", required: false },
            { name: "per_page", in: "query", required: false },
            { name: "search", in: "query", required: false },
          ],
          authType: "none",
        },
      ];
    }
    case "shopify": {
      const shop = String(config.shop ?? "")
        .replace(/^https?:\/\//, "")
        .replace(/\.myshopify\.com$/, "");
      const token = String(config.accessToken ?? "");
      if (!shop || !token) return [];
      return [
        {
          name: "shopify_get_order",
          description: "Obtiene un pedido de Shopify por ID",
          method: "GET",
          baseUrl: `https://${shop}.myshopify.com`,
          path: "/admin/api/2024-01/orders/{orderId}.json",
          parameters: [
            { name: "orderId", in: "path", required: true, schema: { type: "string" } },
          ],
          authType: "header",
          authHeaderName: "X-Shopify-Access-Token",
          authSecret: token,
        },
        {
          name: "shopify_list_products",
          description: "Lista productos Shopify (límite en query limit, título en title)",
          method: "GET",
          baseUrl: `https://${shop}.myshopify.com`,
          path: "/admin/api/2024-01/products.json",
          parameters: [
            { name: "limit", in: "query", required: false },
            { name: "title", in: "query", required: false },
          ],
          authType: "header",
          authHeaderName: "X-Shopify-Access-Token",
          authSecret: token,
        },
      ];
    }
    case "zendesk": {
      const subdomain = String(config.subdomain ?? "");
      const email = String(config.email ?? "");
      const token = String(config.apiToken ?? "");
      const auth = btoa(`${email}/token:${token}`);
      return [
        {
          name: "zendesk_get_ticket",
          description: "Obtiene un ticket de Zendesk por ID",
          method: "GET",
          baseUrl: `https://${subdomain}.zendesk.com`,
          path: "/api/v2/tickets/{ticketId}.json",
          parameters: [
            { name: "ticketId", in: "path", required: true, schema: { type: "string" } },
          ],
          authType: "header",
          authHeaderName: "Authorization",
          authSecret: `Basic ${auth}`,
        },
        {
          name: "zendesk_search_tickets",
          description:
            "Busca tickets en Zendesk (query en path query, URL-encoded)",
          method: "GET",
          baseUrl: `https://${subdomain}.zendesk.com`,
          path: "/api/v2/search.json",
          parameters: [{ name: "query", in: "query", required: true }],
          authType: "header",
          authHeaderName: "Authorization",
          authSecret: `Basic ${auth}`,
        },
      ];
    }
    case "supabase": {
      const projectUrl = String(config.projectUrl ?? "").replace(/\/$/, "");
      const apiKey = String(config.apiKey ?? "");
      if (!projectUrl || !apiKey) return [];
      const headers: Record<string, string> = {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      };
      return [
        {
          name: "supabase_select_rows",
          description:
            "Lee filas de una tabla PostgREST (path table; query select, limit, order, filtros column=eq.valor)",
          method: "GET",
          baseUrl: projectUrl,
          path: "/rest/v1/{table}",
          parameters: [
            { name: "table", in: "path", required: true },
            { name: "select", in: "query", required: false },
            { name: "limit", in: "query", required: false },
            { name: "order", in: "query", required: false },
          ],
          authType: "none",
          extraHeaders: headers,
        },
      ];
    }
    case "postgres_proxy": {
      const proxyUrl = String(config.proxyUrl ?? "");
      return [
        {
          name: "sql_query_readonly",
          description: "Ejecuta consulta de solo lectura vía proxy HTTP",
          method: "POST",
          baseUrl: proxyUrl,
          path: "/query",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: { type: "object", properties: { sql: { type: "string" } } },
            },
          ],
          authType: "bearer",
          authSecret: config.proxyToken ? String(config.proxyToken) : undefined,
        },
      ];
    }
    default:
      return [];
  }
}

export async function persistConnectorTools(
  db: D1Database,
  botId: string,
  connectorId: string,
  defs: ConnectorToolDef[],
  encryptionKey: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM bot_http_tools WHERE bot_id = ? AND name LIKE ?`)
    .bind(botId, `conn_${connectorId}_%`)
    .run();

  for (const t of defs) {
    const authSecretEnc = t.authSecret
      ? await encryptSecret(t.authSecret, encryptionKey)
      : null;
    await db
      .prepare(
        `INSERT INTO bot_http_tools (id, bot_id, name, description, method, path, base_url, auth_type, auth_header_name, auth_secret_enc, parameters_json, headers_json, source, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 1)`,
      )
      .bind(
        randomId(),
        botId,
        `conn_${connectorId}_${t.name}`.slice(0, 64),
        t.description,
        t.method,
        t.path,
        t.baseUrl,
        t.authType,
        t.authHeaderName ?? null,
        authSecretEnc,
        JSON.stringify(t.parameters),
        t.extraHeaders ? JSON.stringify(t.extraHeaders) : null,
      )
      .run();
  }
}
