# ADR: Fuentes de verdad de comercio

## Estado

Aceptado (oleada 1 — seguridad y coherencia).

## Contexto

Desk vende en el chat (Harness 2) con RAG, herramientas HTTP y carrito en el `ConversationDO`. Mezclar secretos, precios de PDF y precios operativos en el mismo canal expone tokens al modelo y permite totales de pedido incorrectos.

## Decisión

| Dato | Fuente autorizada | Nunca |
|------|-------------------|--------|
| Tono, políticas, FAQs | RAG / instrucciones | — |
| Secretos (API keys, tokens) | Bóveda D1 cifrada (`auth_secret_enc`) | RAG, system prompt, respuestas al visitante |
| Precio/stock para **carrito y pedido** | Herramientas de catálogo (HTTP o D1 nativo), caché de turno en DO | `priceCents` inventado por el LLM; PDF como total de cobro |
| Precio **informativo** en conversación | RAG / instrucciones (con disclaimer si puede estar desactualizado) | Sustituir consulta a catálogo cuando hay herramientas |
| Estado de pago **confirmado** | Panel admin (JWT), webhook verificado del proveedor | Herramienta LLM `confirm_payment` |
| Comprobante del cliente | `submit_payment_evidence` (visitante) → `pending_verification` | Marcar `paid` solo por imagen o texto del cliente |

## Consecuencias

- El panel no ofrece subir “Conexiones y credenciales” como documento RAG.
- Con herramientas HTTP de catálogo activas, `commerce_cart_add` exige precio en caché de turno tras una llamada de catálogo.
- Sin catálogo conectado, el carrito acepta `priceCents` del modelo temporalmente y registra `commerce_events` `cart.price_from_llm` hasta catálogo nativo D1 (oleada 2).
- Oleada 2: tabla `products`, confirmación de pago solo vía admin, página pública `/o/{ref}`.

## Relación

Ver [harness-2-commerce.md](./harness-2-commerce.md) para carrito, D1 y checkout por enlace.
