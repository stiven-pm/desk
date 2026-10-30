# ADR: router de intención del visitante

## Estado

Aceptado.

## Contexto

El chat enrutaba casi todo al LLM con un system prompt muy grande (RAG + Harness 2 commerce + tools). Eso aumentaba costo, latencia y fallos visibles (p. ej. saludos cuando Workers AI fallaba). La industria recomienda **orquestación system-driven** antes del modelo grande.

## Decisión

1. **`classifyVisitorTurn`** en `packages/runtime/src/intent-router.ts` antes de `callLlm`.
2. Intenciones: `small_talk`, `catalog_browse`, `commerce_order`, `faq_policy`, `general`.
3. **`small_talk`**: respuesta local (`visitor-small-talk-reply.ts`), sin LLM, todos los canales.
4. **`shouldAttachCommerceTools`**: tools `commerce_*` y sección Harness 2 en prompt solo en browse/order o carrito con líneas.
5. **Telemetría**: logs JSON `desk_visitor_turn` y `desk_llm_visitor_failure` (grep en tail del Worker).

## Consecuencias

- FAQ y preguntas generales no cargan el arnés de venta si no hay carrito.
- El **Harness 2** (estado carrito, D1) sigue en el DO; solo se **expone al modelo** cuando el turno lo pide.
- Pendiente: router con modelo barato para intenciones ambiguas; trazas OpenTelemetry.

## Relación

- Comercio: [harness-2-commerce.md](./harness-2-commerce.md) (producto).
- Arnés de tools: [../CHAT_AI_ARCHITECTURE.md](../CHAT_AI_ARCHITECTURE.md) (`harness_search_tools`, lazy catalog).
