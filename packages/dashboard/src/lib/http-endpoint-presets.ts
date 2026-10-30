/** Plantillas HTTP habituales en CRM, pedidos y ERP (no sustituyen OpenAPI/MCP). */

export type HttpPresetId =
  | "crm_contact"
  | "order_lookup"
  | "erp_odata"
  | "bearer_get"
  | "post_json";

export const HTTP_ENDPOINT_PRESETS: Array<{
  id: HttpPresetId;
  label: string;
  hint: string;
}> = [
  { id: "crm_contact", label: "Contacto CRM", hint: "GET contacto por ID" },
  { id: "order_lookup", label: "Pedido", hint: "Consulta pedido por número" },
  { id: "erp_odata", label: "SAP OData (ejemplo)", hint: "Entidad OData con {id}" },
  { id: "bearer_get", label: "GET genérico", hint: "Recurso REST con bearer" },
  { id: "post_json", label: "POST JSON", hint: "Crear ticket o registro" },
];
