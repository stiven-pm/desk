/** Catálogo de integraciones — el cliente aporta credenciales (BYOK). */

import type { IntegrationBrand } from "./integration-brand";

export type IntegrationFieldType = "text" | "password" | "url";

export interface IntegrationField {
  key: string;
  label: string;
  type: IntegrationFieldType;
  placeholder?: string;
  required?: boolean;
}

export interface IntegrationCatalogEntry {
  id: string;
  connectorKey: string;
  name: string;
  category: "crm" | "erp" | "ecommerce" | "sheets" | "support" | "data" | "custom";
  blurb: string;
  /** Enlace a docs del proveedor (opcional). */
  helpUrl?: string;
  fields: IntegrationField[];
  /** Colombia / LATAM relevance */
  regions: ("co" | "latam" | "global")[];
  /** Logo / color para panel y marketing */
  brand?: IntegrationBrand;
}

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    id: "hubspot",
    connectorKey: "hubspot",
    name: "HubSpot CRM",
    category: "crm",
    blurb: "Token de app privada de tu portal HubSpot.",
    helpUrl: "https://developers.hubspot.com/docs/api/private-apps",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "hubspot", iconColor: "FF7A59" },
    fields: [
      {
        key: "accessToken",
        label: "Token de app privada",
        type: "password",
        required: true,
      },
    ],
  },
  {
    id: "siigo",
    connectorKey: "siigo",
    name: "Siigo Nube",
    category: "erp",
    blurb:
      "Usuario API, Access Key y Partner-Id (Alianzas → Mi credencial API). El token JWT se renueva solo; tus credenciales no expiran cada 24 h.",
    helpUrl: "https://developers.siigo.com/docs/siigoapi/autenticacion/autenticacion",
    regions: ["co", "latam"],
    brand: { iconColor: "00A0DF" },
    fields: [
      { key: "username", label: "Usuario API", type: "text", required: true },
      { key: "accessKey", label: "Access Key", type: "password", required: true },
      { key: "partnerId", label: "Partner-Id", type: "text", required: true },
    ],
  },
  {
    id: "alegra",
    connectorKey: "alegra",
    name: "Alegra",
    category: "erp",
    blurb: "Usuario y token desde Integración manual (API) en Alegra.",
    helpUrl: "https://ayuda.alegra.com/col/integraciones-via-api",
    regions: ["co", "latam"],
    brand: { iconColor: "00B388" },
    fields: [
      { key: "email", label: "Usuario (email)", type: "text", required: true },
      { key: "token", label: "Token API", type: "password", required: true },
    ],
  },
  {
    id: "odoo",
    connectorKey: "odoo",
    name: "Odoo",
    category: "erp",
    blurb: "URL de tu instancia y API key del usuario bot.",
    helpUrl: "https://www.odoo.com/documentation/19.0/developer/reference/external_api.html",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "odoo", iconColor: "714B67" },
    fields: [
      { key: "baseUrl", label: "URL (https://tu-empresa.odoo.com)", type: "url", required: true },
      { key: "database", label: "Base de datos (opcional en Odoo Online)", type: "text" },
      { key: "apiKey", label: "API key", type: "password", required: true },
    ],
  },
  {
    id: "shopify",
    connectorKey: "shopify",
    name: "Shopify",
    category: "ecommerce",
    blurb: "Dominio de tu tienda y token de Admin API (app personalizada).",
    helpUrl: "https://shopify.dev/docs/api/admin-rest",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "shopify", iconColor: "7AB55C" },
    fields: [
      { key: "shop", label: "Tienda (mi-marca.myshopify.com)", type: "text", required: true },
      { key: "accessToken", label: "Admin API access token", type: "password", required: true },
    ],
  },
  {
    id: "woocommerce",
    connectorKey: "woocommerce",
    name: "WooCommerce",
    category: "ecommerce",
    blurb: "REST API keys de WooCommerce → Ajustes → Avanzado.",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "woocommerce", iconColor: "96588A" },
    fields: [
      { key: "siteUrl", label: "URL de la tienda", type: "url", required: true },
      { key: "consumerKey", label: "Consumer key", type: "password", required: true },
      { key: "consumerSecret", label: "Consumer secret", type: "password", required: true },
    ],
  },
  {
    id: "google_sheets",
    connectorKey: "google_sheets",
    name: "Google Sheets (listas y precios)",
    category: "sheets",
    blurb:
      "Catálogo o inventario en una hoja de Google. Si solo tienes Excel, súbelo en Documentos o sincroniza la hoja con Google.",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "googlesheets", iconColor: "34A853" },
    fields: [
      { key: "spreadsheetId", label: "ID de la hoja", type: "text", required: true },
      { key: "range", label: "Rango", type: "text", placeholder: "A1:Z500" },
      { key: "apiKey", label: "API key (opcional)", type: "password" },
    ],
  },
  {
    id: "zendesk",
    connectorKey: "zendesk",
    name: "Zendesk",
    category: "support",
    blurb: "Subdominio, email de agente y token API.",
    regions: ["global"],
    brand: { simpleIcon: "zendesk", iconColor: "03363D" },
    fields: [
      { key: "subdomain", label: "Subdominio", type: "text", required: true },
      { key: "email", label: "Email agente", type: "text", required: true },
      { key: "apiToken", label: "Token API", type: "password", required: true },
    ],
  },
  {
    id: "supabase",
    connectorKey: "supabase",
    name: "Supabase",
    category: "data",
    blurb:
      "URL del proyecto y API key (anon o service role). Consultas vía PostgREST /rest/v1 — respeta RLS si usas anon.",
    helpUrl: "https://supabase.com/docs/guides/api",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "supabase", iconColor: "3FCF8E" },
    fields: [
      {
        key: "projectUrl",
        label: "URL del proyecto",
        type: "url",
        placeholder: "https://xxxx.supabase.co",
        required: true,
      },
      {
        key: "apiKey",
        label: "API key (anon o service_role)",
        type: "password",
        required: true,
      },
    ],
  },
  {
    id: "postgres_proxy",
    connectorKey: "postgres_proxy",
    name: "PostgreSQL / Neon",
    category: "data",
    blurb:
      "Neon y Postgres no exponen SQL por HTTP: tú despliegas un proxy de solo lectura (o tu API) y Desk llama ahí. No guardamos connection strings directos.",
    regions: ["co", "latam", "global"],
    brand: { simpleIcon: "neon", iconColor: "00E599" },
    fields: [
      {
        key: "proxyUrl",
        label: "URL base del proxy HTTP",
        type: "url",
        placeholder: "https://sql-proxy.tu-empresa.com",
        required: true,
      },
      {
        key: "proxyToken",
        label: "Bearer token del proxy (opcional)",
        type: "password",
      },
    ],
  },
];

export function catalogEntryForConnectorKey(
  key: string,
): IntegrationCatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((e) => e.connectorKey === key);
}

export function catalogEntryById(id: string): IntegrationCatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((e) => e.id === id);
}
