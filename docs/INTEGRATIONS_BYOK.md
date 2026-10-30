# Integraciones BYOK (credenciales del cliente)

Desk no exige que Rekov configure `GOOGLE_OAUTH_*`, `HUBSPOT_*` ni tokens de Shopify en el Worker. Cada organización conecta **su** CRM, ERP o tienda con las credenciales que ya genera en el proveedor (mismo patrón que Zapier, Apideck o un puente fiscal).

## Flujo

1. En **Integraciones**, elige el sistema del catálogo.
2. Completa los campos (usuario API, token, Partner-Id, URL de instancia, etc.).
3. Al guardar, la API valida cuando aplica (p. ej. Siigo intercambia usuario + access key por JWT).
4. Se crean herramientas HTTP para el agente; los secretos van cifrados en D1.

Si ya tenías un conector guardado antes de ampliar el catálogo de herramientas, **vuelve a guardar** la integración para regenerar las tools en D1.

## Herramientas por conector (resumen)

Además de consultas básicas, Desk materializa tools como: Siigo (clientes, productos, factura por ID, listado de facturas), Alegra (contactos, ítems, factura), HubSpot (búsqueda de contactos/deals, contacto por ID), Odoo (partners y productos), WooCommerce/Shopify (pedido y listado de productos), Zendesk (ticket y búsqueda).

## Webhooks y commerce

- `commerce.intent` — clic en ofertas del chat (`continue` | `pay` | `human`).
- Con `intent: human`, Desk encola la conversación en la bandeja (`needs_human`), notifica al DO y emite `conversation.handoff`.
- En **Integraciones → Webhook**, puedes definir una **allowlist de claves** del `payload` (migración `0009_org_commerce_payload.sql`); valores fuera de lista o demasiado grandes devuelven 400.

## Marca visual (logos)

Cada entrada del catálogo en `packages/domain` puede llevar `brand: { simpleIcon?, iconColor? }`. El panel y el copy de marketing usan el mismo dato vía `marketingConnectorBrand()` e `integrationSimpleIconCdnUrl()`.

## Catálogo (Colombia / LATAM)

| Sistema | Qué pega el cliente | Notas |
|--------|---------------------|--------|
| **Siigo Nube** | Usuario API, Access Key, Partner-Id | Mismo modelo que documenta Siigo: `POST /auth` con usuario + access key y cabecera `Partner-Id`. El **access key no caduca a las 24 h**; solo el **JWT** (~24 h). Desk guarda usuario/key y **renueva el token automáticamente** antes de cada conversación que use herramientas Siigo. No hay otro “login OAuth” para el tenant: es API Siigo Nube o integración vía OpenAPI/REST propio. |
| **Alegra** | Email + token API | Integración manual en Alegra. |
| **Odoo** | URL, API key, base (opcional) | API key del usuario bot en la instancia. |
| **HubSpot** | Token de app privada | Sin OAuth de plataforma. |
| **Shopify** | Dominio + Admin API token | App personalizada en la tienda. |
| **WooCommerce** | URL + consumer key/secret | REST en Ajustes → Avanzado. |
| **Google Sheets** | ID de hoja, rango, API key **o** token OAuth previo | API key de tu proyecto GCP con Sheets API habilitada. |
| **Zendesk** | Subdominio, email agente, token API | |
| **Supabase** | URL del proyecto + API key | PostgREST `/rest/v1`; usa RLS con key `anon` |
| **PostgreSQL / Neon** | URL de proxy HTTP + token opcional | Neon no tiene REST SQL: tú expones consultas read-only (microservicio, Hyperdrive en tu stack, etc.) |

## Seguridad (resumen)

- Credenciales del tenant: cifradas en D1; el chat público no las expone.
- HTTP/OpenAPI: el cliente define auth (Bearer, cabecera); usar HTTPS.
- MCP: el servidor debe ser privado; Desk soporta cabeceras cifradas (p. ej. `Authorization`). Ver [Model Context Protocol — architecture](https://modelcontextprotocol.io/docs/concepts/architecture).
- Webhooks salientes: firma HMAC opcional (`X-Desk-Signature`).

## Excel

Desk no abre archivos `.xlsx` como base de datos en vivo. Opciones: subir el archivo en **Documentos** (RAG) o conectar **Google Sheets** con el mismo catálogo/precios.

## SAP y ERP sin conector en tarjeta

Usa **Sistema propio o SAP** en el panel: OpenAPI de SAP BTP, OData o API REST con token. No hay conector SAP “en un clic” porque cada cliente expone distinto endpoint.

## Alternativas genéricas

- **OpenAPI**: cualquier API con spec (SAP BTP, servicios internos).
- **API REST rápida** (`custom_rest`): URL base + bearer + rutas.
- **HTTP manual** y **MCP** para stacks propios.

## OAuth de plataforma (legacy)

Las rutas `/v1/admin/oauth/*` siguen existiendo para quien ya tenga app OAuth global; la UI principal usa BYOK. No son requisito para HubSpot, Shopify ni Sheets si el cliente aporta token o API key.

## Migraciones D1

- `0007_http_tool_headers.sql` — cabeceras extra (p. ej. Siigo `Partner-Id`).
- `0009_org_commerce_payload.sql` — allowlist opcional de claves en `commerce.intent`.
