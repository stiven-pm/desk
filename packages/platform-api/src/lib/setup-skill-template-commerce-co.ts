/** Plantilla verificada para publicar como skill del setup-agent (slug: commerce-co-native). */
export const COMMERCE_CO_NATIVE_SKILL = {
  slug: "commerce-co-native",
  title: "Comercio nativo Colombia (Desk)",
  description:
    "Flujo probado: catálogo nativo, pedido RK-REF, link de pago y webhook según plantilla Ops.",
  bodyMd: `# Comercio nativo Colombia (Desk)

## Objetivo
Configurar venta por chat con **precios del catálogo** (nunca inventados por el modelo), pedidos con referencia **RK-####** y cobro **manual** (transferencia) u **automático** (webhook).

## Checklist (verificar con desk_workspace_status)
1. **Perfil**: \`/dashboard/commerce-setup\` completado.
2. **Catálogo**: productos publicados en Panel → Catálogo o borrador desde PDF revisado.
3. **Pago**: datos bancarios en Panel o webhooks CO en Panel (modo automático).
4. **Chat**: clave publicable activa y widget probado.

## Secretos
- **Nunca** subir tokens a documentos RAG.
- Usar \`desk_request_credentials\` + modal, o Integraciones / HTTP tools cifrados.

## HTTP catálogo (opcional)
1. \`desk_probe_http\` contra el endpoint de listado (allowlist + SSRF).
2. \`desk_add_http_tool\` o importar cURL en Capacidades → Conexiones.
3. Probar una búsqueda; luego \`desk_skill_save\` con el flujo y \`desk_skill_publish\`.

## Pedidos
- El visitante usa herramientas \`commerce_*\` (carrito, submit order, evidencia de pago).
- Enlace público: \`/o/{public_access_token}\` (comprobante / post-pago). Referencia transferencia: \`public_ref\` (RK-…).
- El panel confirma pagos manuales en Pedidos.

## Webhooks CO (automático)
- URLs en Panel → datos de pago → Pasarelas.
- Referencia en pasarela = \`public_ref\` del pedido (RK-…).
- Tras configurar, \`desk_probe_http\` no aplica; validar con un pago de prueba.

## Chat web
- Los bloques desk-ui se muestran en el widget; catálogo y totales deben quedar claros en prosa cuando haga falta.

## Cierre
Tras mutaciones: \`desk_workspace_status\` y, si hay HTTP, \`desk_probe_http\` antes de dar por terminado.
`,
} as const;
