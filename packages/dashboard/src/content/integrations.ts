import { marketingConnectorBrand, type IntegrationBrand } from "@chatbot/domain";

export type IntegrationKind = "self-serve" | "guided" | "ops";

export interface IntegrationMethod {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  kind: IntegrationKind;
  href?: string;
  cta?: string;
}

export const integrationMethods: IntegrationMethod[] = [
  {
    id: "rag",
    title: "Documentos y políticas",
    summary: "PDFs, manuales y catálogos que el asistente usa al responder.",
    bullets: [
      "Subes archivos desde el panel; Desk los indexa para búsqueda semántica.",
      "Ideal para políticas, FAQs largas y material que no cambia cada minuto.",
    ],
    kind: "self-serve",
    href: "/dashboard/documents",
    cta: "Gestionar conocimiento",
  },
  {
    id: "openapi",
    title: "OpenAPI y endpoints HTTP",
    summary:
      "Pega tu especificación OpenAPI o define endpoints: la IA elige la operación según la pregunta.",
    bullets: [
      "Una API REST (o GraphQL vía proxy) como fuente de verdad en tiempo real.",
      "Autenticación con secretos por asistente; solo métodos que tú habilites.",
      "En Business: acciones HTTP generadas desde el spec.",
    ],
    kind: "guided",
    href: "/dashboard/configuracion?tab=integraciones#openapi",
    cta: "Configurar API",
  },
  {
    id: "mcp",
    title: "MCP y automatización",
    summary:
      "Conecta servidores MCP, n8n o Make para sistemas sin API cómoda o flujos compuestos.",
    bullets: [
      "Desk invoca herramientas aprobadas; tú controlas qué puede leer o ejecutar.",
      "Útil para SaaS cerrados, bases internas o pipelines que ya tienes montados.",
    ],
    kind: "guided",
    href: "/dashboard/configuracion?tab=integraciones#mcp",
    cta: "Ver MCP",
  },
  {
    id: "connectors",
    title: "Conectores del mercado",
    summary:
      "Plantillas para CRM, e-commerce, hojas de cálculo y mesas de ayuda — credenciales en el panel.",
    bullets: [
      "OAuth o API key según el proveedor; permisos de solo lectura al inicio.",
      "Misma IA: mezcla documentos + datos vivos en una sola conversación.",
    ],
    kind: "guided",
    href: "/dashboard/configuracion?tab=integraciones#catalogo",
    cta: "Ver catálogo",
  },
];

export interface ConnectorTemplate {
  id: string;
  name: string;
  category: string;
  blurb: string;
  setup: string[];
  brand?: IntegrationBrand;
}

export const connectorCatalog: ConnectorTemplate[] = [
  {
    id: "sheets",
    name: "Google Sheets",
    category: "Datos tabulares",
    blurb: "Listas de precios, inventario ligero o catálogos que viven en hojas.",
    setup: ["Cuenta Google", "Rango o hoja permitida", "Sincronización cada hora o bajo demanda"],
    brand: marketingConnectorBrand("sheets"),
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    blurb: "Contactos, deals y notas para personalizar respuestas.",
    setup: ["OAuth HubSpot", "Scopes de lectura", "Mapeo de campos en el asistente"],
    brand: marketingConnectorBrand("hubspot"),
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "E-commerce",
    blurb: "Estado de pedidos, productos y envíos.",
    setup: ["App privada o OAuth", "Storefront / Admin API según necesidad"],
    brand: marketingConnectorBrand("shopify"),
  },
  {
    id: "zendesk",
    name: "Zendesk / Freshdesk",
    category: "Mesa de ayuda",
    blurb: "Tickets abiertos y artículos de ayuda estructurados.",
    setup: ["API token", "Subdominio", "Solo tickets del solicitante cuando aplique"],
    brand: marketingConnectorBrand("zendesk"),
  },
  {
    id: "postgres",
    name: "Supabase / PostgreSQL",
    category: "Datos",
    blurb: "Supabase vía PostgREST; Neon/Postgres vía proxy HTTP de solo lectura (BYOK).",
    setup: [
      "Supabase: URL + API key",
      "Neon: proxy tuyo (Desk no abre TCP directo)",
    ],
    brand: marketingConnectorBrand("supabase"),
  },
  {
    id: "webhook",
    name: "Webhooks salientes",
    category: "Eventos",
    blurb: "Avisa a tu software cuando un agente toma el chat o se cierra la conversación.",
    setup: ["URL HTTPS", "Secreto de firma", "Reintentos configurables"],
    brand: marketingConnectorBrand("webhook"),
  },
];

export const integrationsSetupNote =
  "En todos los planes incluimos setup inicial contigo: dejamos operativa la primera conexión a tus sistemas (API, MCP, conector o flujo acordado). El resto de límites (tools, MCP, conectores) depende del plan.";

export const opsAssistNote =
  "Stack muy particular o varias integraciones a la vez: contact@rekov.co — seguimos contigo después del setup inicial.";
