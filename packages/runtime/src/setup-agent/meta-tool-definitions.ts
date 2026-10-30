import type { LlmToolSchema } from "../integrations/types";

/** Meta-herramientas del agente Setup (admin). Sin bash/exec; mutan config del bot de forma controlada. */
export const SETUP_META_TOOL_DEFINITIONS: LlmToolSchema[] = [
  {
    type: "function",
    function: {
      name: "desk_workspace_status",
      description:
        "Resumen del bot: instrucciones, documentos, herramientas HTTP/MCP, conectores y skills.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_set_instructions",
      description:
        "Actualiza las instrucciones del asistente público (system prompt del bot).",
      parameters: {
        type: "object",
        properties: {
          instructions: {
            type: "string",
            description: "Texto completo de instrucciones para el bot visitor.",
          },
        },
        required: ["instructions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_add_http_tool",
      description:
        "Registra una herramienta HTTP para el chat público (REST). Cifra bearer/header si se envía authSecret.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          },
          baseUrl: { type: "string" },
          path: { type: "string" },
          parameters: { type: "array", items: { type: "object" } },
          authType: { type: "string", enum: ["none", "bearer", "header"] },
          authHeaderName: { type: "string" },
          authSecret: {
            type: "string",
            description: "Token o API key; se guarda cifrado, no se repite al modelo.",
          },
          enabled: { type: "boolean" },
        },
        required: ["name", "description", "method", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_register_mcp_server",
      description:
        "Conecta un servidor MCP por URL; las tools se descubren en el chat público.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          serverUrl: { type: "string" },
          headers: { type: "object", additionalProperties: { type: "string" } },
          enabled: { type: "boolean" },
        },
        required: ["name", "serverUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_upsert_connector",
      description:
        "Activa un conector predefinido (shopify, hubspot, google_sheets, woocommerce, custom_rest, etc.) con config JSON.",
      parameters: {
        type: "object",
        properties: {
          connectorKey: { type: "string" },
          config: { type: "object" },
          enabled: { type: "boolean" },
        },
        required: ["connectorKey", "config"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_probe_http",
      description:
        "Prueba GET/HEAD a una URL HTTPS pública (diagnóstico de API). No envía secretos en logs.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          method: { type: "string", enum: ["GET", "HEAD"] },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_fetch_docs",
      description:
        "Descarga texto de documentación pública (OpenAPI, páginas de ayuda) para diseñar la integración.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
          maxChars: { type: "number" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_skill_read",
      description:
        "Lee el procedimiento completo (markdown) por slug antes de editarlo.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_skill_save",
      description:
        "Crea o actualiza un skill (procedimiento). Por defecto queda en borrador hasta publicar.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Identificador snake_case, ej. consultar_pedido",
          },
          title: { type: "string" },
          description: { type: "string" },
          body_md: {
            type: "string",
            description: "Pasos en markdown que el bot visitor debe seguir.",
          },
          publish: {
            type: "boolean",
            description: "Si true, publica de inmediato para el chat público.",
          },
        },
        required: ["slug", "title", "body_md"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_skill_publish",
      description:
        "Publica skills: uno por slug o todos los borradores si slug omitido.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_skill_archive",
      description: "Archiva un skill para que el visitor no lo use.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_request_credentials",
      description:
        "Abre un formulario seguro en el panel para que el admin ingrese secretos (NO pedir tokens en el chat). Devuelve requestId; espera a que el admin complete el modal.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          purpose: { type: "string" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                label: { type: "string" },
                type: { type: "string", enum: ["text", "password", "url"] },
                required: { type: "boolean" },
              },
              required: ["key", "label"],
            },
          },
          apply: {
            type: "object",
            description:
              "connector: {kind,connectorKey,fieldMap}; openapi: {kind,baseUrl,authType,fieldMap}; http_tool: {kind,tool,authField}",
          },
        },
        required: ["title", "fields", "apply"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_import_openapi_url",
      description:
        "Descarga una spec OpenAPI/Swagger desde URL y genera herramientas HTTP automáticamente.",
      parameters: {
        type: "object",
        properties: {
          specUrl: { type: "string" },
          baseUrl: { type: "string" },
          authType: { type: "string", enum: ["none", "bearer", "header"] },
          authHeaderName: { type: "string" },
          authSecret: { type: "string" },
        },
        required: ["specUrl", "baseUrl"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "desk_enterprise_shell_queue",
      description:
        "Plan Business: encola un trabajo shell/Computer (npm, scripts, integraciones que requieren Linux). Devuelve jobId y enlace de consola si está configurado.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          instructionsMd: {
            type: "string",
            description: "Pasos detallados para el operador o runtime shell.",
          },
        },
        required: ["summary", "instructionsMd"],
      },
    },
  },
];
