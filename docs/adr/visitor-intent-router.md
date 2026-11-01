# ADR: router de intención del visitante

## Estado

Aceptado (actualizado oct 2026 — router simplificado).

## Contexto

El chat enrutaba casi todo al LLM con un system prompt muy grande (RAG + commerce + tools). Eso aumentaba costo, latencia y fallos visibles.

## Decisión (vigente)

1. **`classifyVisitorTurn`** en `packages/runtime/src/intent-router.ts` antes del agente/LLM.
2. Intenciones efectivas: **`small_talk`** (solo mensaje vacío) y **`general`** (todo lo demás va al LLM/agente).
3. **`shouldAttachCommerceTools`**: tools `commerce_*` y contexto de tienda cuando hay catálogo nativo, carrito con líneas u org con commerce.
4. **Telemetría**: `desk_visitor_turn`, `desk_llm_visitor_failure`, `desk_agent_llm_attempt`, `desk_llm_ladder`, `desk_agent_turn_rescue`.

## Consecuencias

- No hay clasificador NL por regex ni respuestas locales de saludo (salvo mensaje vacío → `small_talk`).
- El agente elige tools en bucle; fallos de tool vuelven al modelo; fallo del proveedor usa escalera antes del mensaje de rescate.
- Histórico: existieron intenciones `catalog_browse` / `faq_policy` y arnés `harness_search_tools`; **retirados** — ver [CHAT_AI_ARCHITECTURE.md](../CHAT_AI_ARCHITECTURE.md) y [AI.md](../AI.md).

## Relación

- Comercio: [harness-2-commerce.md](./harness-2-commerce.md) (producto).
- Agente visitante: [../CHAT_AI_ARCHITECTURE.md](../CHAT_AI_ARCHITECTURE.md), [../AI.md](../AI.md).
