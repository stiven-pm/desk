# Runbook: purgar credenciales del índice RAG

## Cuándo usarlo

Un tenant subió el slot **«Conexiones y credenciales»** (o un PDF con tokens/URLs) al panel de conocimiento. Esos fragmentos pueden aparecer en el contexto del modelo y ser extraíbles con prompt injection.

## Pasos

1. **Identificar el documento** en D1 (`sources`), por ejemplo:
   ```sql
   SELECT id, org_id, bot_id, title, document_filename
   FROM sources
   WHERE title = 'Conexiones y credenciales';
   ```
2. **Eliminar desde el panel** (Panel → alerta amarilla «Eliminar archivo de credenciales») o `DELETE /v1/admin/documents/:sourceId`.
   - Esto borra R2 y hace best-effort de borrado en Vectorize (`sourceId:0` … `sourceId:255`).
3. **Rotar todos los secretos** que estuvieron en el archivo (API keys, tokens Shopify/Woo, etc.) en el proveedor externo.
4. **Volver a conectar** en [Capacidades](/dashboard/capabilities) o [Integraciones](/dashboard/integrations) con el formulario cifrado (no subir PDF).
5. **Comprobar**: nuevo chat de visitante; pedir al modelo que repita contexto — no deben aparecer tokens.

## Prevención

- `POST /v1/admin/documents` rechaza `title = Conexiones y credenciales` con código `use_integrations_for_secrets`.
- Documentación: [commerce-sources-of-truth.md](../adr/commerce-sources-of-truth.md).
