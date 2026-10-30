import type { IntegrationCatalogEntry, IntegrationBrand } from "@chatbot/domain";
import { INTEGRATION_CATALOG, integrationExtraTileBrand } from "@chatbot/domain";

export type IntegrationTileCategory =
  | IntegrationCatalogEntry["category"]
  | "developer"
  | "events";

export type TileMethodType =
  | "catalog"
  | "openapi"
  | "http"
  | "mcp"
  | "custom_rest"
  | "webhook";

export interface TileMethodDef {
  type: TileMethodType;
  /** Etiqueta en el listado de formas de conectar */
  label: string;
  description: string;
  keywords: string[];
  catalogId?: string;
}

export interface IntegrationTileDef {
  id: string;
  name: string;
  subtitle: string;
  category: IntegrationTileCategory;
  keywords: string[];
  brand?: IntegrationBrand;
  methods: TileMethodDef[];
}

const CATEGORY_LABELS: Record<IntegrationTileCategory, string> = {
  erp: "ERP",
  crm: "CRM",
  ecommerce: "E-commerce",
  sheets: "Excel y hojas",
  support: "Soporte",
  data: "Datos y almacenamiento",
  custom: "Personalizado",
  developer: "API y código",
  events: "Eventos",
};

export function integrationCategoryLabel(c: IntegrationTileCategory): string {
  return CATEGORY_LABELS[c];
}

function catalogTile(entry: IntegrationCatalogEntry): IntegrationTileDef {
  return {
    id: entry.id,
    name: entry.name,
    subtitle: entry.blurb,
    category: entry.category,
    keywords: [
      entry.name,
      entry.connectorKey,
      entry.category,
      ...entry.regions,
      ...entry.fields.map((f) => f.label),
    ],
    brand: entry.brand,
    methods: [
      {
        type: "catalog",
        catalogId: entry.id,
        label: "Conectar mi cuenta",
        description: "Usuario, token o API key que generas en el panel del proveedor.",
        keywords: ["token", "api key", "usuario", "credenciales"],
      },
    ],
  };
}

const DEVELOPER_TILE: IntegrationTileDef = {
  id: "developer",
  name: "Sistema propio o SAP",
  subtitle: "Tu API, SAP BTP, middleware o servidor MCP con autenticación",
  category: "developer",
  keywords: [
    "sap",
    "odata",
    "btp",
    "erp",
    "api",
    "interna",
    "openapi",
    "swagger",
    "http",
    "mcp",
    "n8n",
    "make",
    "mercado libre",
  ],
  brand: integrationExtraTileBrand("developer"),
  methods: [
    {
      type: "openapi",
      label: "Documentación OpenAPI",
      description:
        "Tienes un archivo o URL de especificación (común en SAP BTP y APIs modernas). Desk crea las consultas permitidas.",
      keywords: ["openapi", "swagger", "spec", "sap", "btp"],
    },
    {
      type: "http",
      label: "Consultas HTTP puntuales",
      description:
        "Una URL por necesidad (pedido, cliente, stock). Usa HTTPS y token; hay plantillas habituales.",
      keywords: ["get", "post", "crm", "pedido", "inventario", "bearer"],
    },
    {
      type: "mcp",
      label: "Servidor MCP (avanzado)",
      description:
        "Conecta un servidor que ya expone herramientas MCP. Requiere HTTPS y cabeceras de auth; no dejes el servidor público sin protección.",
      keywords: ["mcp", "servidor", "tools", "authorization"],
    },
    {
      type: "custom_rest",
      label: "API con token (rápido)",
      description: "URL base de tu ERP o middleware + bearer y una ruta con {id}.",
      keywords: ["bearer", "token", "erp", "api interna"],
    },
  ],
};

const WEBHOOK_TILE: IntegrationTileDef = {
  id: "webhooks",
  name: "Avisos a tu sistema",
  subtitle: "Cuando alguien pide humano, hace clic en una oferta o escribe en el chat",
  category: "events",
  keywords: ["webhook", "eventos", "handoff", "commerce"],
  brand: integrationExtraTileBrand("webhooks"),
  methods: [
    {
      type: "webhook",
      label: "URL de eventos",
      description: "Recibe POST firmados cuando pasa algo en el chat.",
      keywords: ["url", "secret", "hmac"],
    },
  ],
};

export const INTEGRATION_TILES: IntegrationTileDef[] = [
  ...INTEGRATION_CATALOG.map(catalogTile),
  DEVELOPER_TILE,
  WEBHOOK_TILE,
];

export function tileForCatalogId(catalogId: string): IntegrationTileDef | undefined {
  return INTEGRATION_TILES.find((t) => t.id === catalogId);
}

export function methodSearchText(m: TileMethodDef): string {
  return [m.label, m.description, ...m.keywords].join(" ").toLowerCase();
}

export function tileSearchText(t: IntegrationTileDef): string {
  return [t.name, t.subtitle, t.category, ...t.keywords, ...t.methods.flatMap((m) => m.keywords)]
    .join(" ")
    .toLowerCase();
}
