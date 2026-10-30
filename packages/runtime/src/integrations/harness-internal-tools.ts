import type { LlmToolSchema } from "./types";

export const HARNESS_SEARCH_TOOLS = "harness_search_tools";
export const HARNESS_SELECT_TOOLS = "harness_select_tools";

export const HARNESS_INTERNAL_TOOL_DEFINITIONS: LlmToolSchema[] = [
  {
    type: "function",
    function: {
      name: HARNESS_SEARCH_TOOLS,
      description:
        "Busca acciones conectadas por palabras clave. Devuelve nombres exactos para usar con select_tools.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Intención o palabras del usuario" },
          limit: { type: "number", description: "Máximo resultados (1-8)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: HARNESS_SELECT_TOOLS,
      description:
        "Confirma qué acciones usar. Tras esto recibirás sus parámetros para ejecutarlas.",
      parameters: {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: { type: "string" },
            description: "Nombres exactos del catálogo",
          },
        },
        required: ["names"],
      },
    },
  },
];
