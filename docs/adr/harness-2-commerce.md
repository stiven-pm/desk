# ADR: Harness 2 — commerce en el chat

## Estado

Aceptado (slice A + scaffolding B).

## Contexto

Desk debe vender en el chat: carrito, pedido y pago vía enlace/API del tenant (Wompi, Mercado Pago, web propia), no solo RAG + ofertas embebidas.

## Decisión

1. **Estado de sesión** (carrito, comprador, último pedido) vive en el `ConversationDO` (meta SQL).
2. **Pedidos** persisten en D1 (`sales_orders`, `payment_attempts`, `commerce_events`).
3. **Manifest** por org en `org_commerce_config` (`mode`, `checkoutUrlTemplate`, moneda).
4. **Herramientas LLM** `commerce_*` siempre disponibles en chat público (no dependen de HTTP tools del bot).
5. **desk-ui** bloque `cart` inyectado por el runtime cuando hay líneas; el cliente puede mutar vía API pública.
6. **Checkout**: `commerce_start_checkout` crea pedido + `payment_attempts` y devuelve URL; el chat abre shell iframe y `payment-return` actualiza estado.

## Consecuencias

- Migración D1 `0019_commerce_harness2.sql` obligatoria en cada entorno.
- Panel: configurar manifest vía `PATCH /v1/admin/commerce-harness`.
- Webhooks CO: `0021_commerce_payment_webhooks.sql`, rutas `/webhooks/commerce-payments/{token}/{provider}`; panel → pasarelas.
- Import PDF: `POST /v1/admin/catalog-imports/pdf` → `catalog_import_drafts` → publicar productos draft.
- Pendiente: buyer_form desk-ui enriquecido.
- Fuentes de verdad (RAG vs catálogo vs bóveda): [commerce-sources-of-truth.md](./commerce-sources-of-truth.md).
- Modo nativo (oleada 2): migración `0020_catalog_native.sql`, catálogo en panel, `commerce_search_products`, pedidos en panel, página pública `/o/{ref}`.
