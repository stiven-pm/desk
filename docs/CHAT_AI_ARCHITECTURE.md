# Experiencia de chat e IA (RAG, herramientas, tokens)

## Qué hace Desk hoy

| Capa | Rol |
|------|-----|
| **Instrucciones del tenant** | `system_prompt` del bot — prioridad máxima (tono, marca, venta vs soporte). |
| **Capa Desk** (`persona-prompt`) | Tono humano, uso de herramientas, bloques `desk-ui` para productos/botones. |
| **RAG** | Embeddings (BGE-M3) + Vectorize: fragmentos de PDFs/manuales según la pregunta (`RAG_TOP_K`, límites de contexto). |
| **Agente + herramientas** | Si hay integraciones, el modelo elige funciones HTTP/MCP, encadena llamadas y redacta la respuesta final. |
| **Agente Setup (admin)** | Chat en panel con meta-herramientas: autoconectar APIs/MCP, skills, instrucciones. Ver `docs/SETUP_AGENT.md`. |
| **Skills (procedimientos)** | Tabla `bot_skills`; publicados se inyectan en el prompt del visitor. |
| **Streaming** | Chat sin herramientas: tokens en vivo. Con herramientas: respuesta final de una vez (mejora futura: stream en el último turno). |
| **UI rica** | Bloque ` ```desk-ui ` JSON en la respuesta → tarjetas de producto y chips clicables en el chat público. |

## RAG, CAG, KAG (en lenguaje simple)

- **RAG** (lo que usamos): recuperar trozos relevantes de documentos y meterlos en el prompt. Bueno para políticas, manuales, catálogos estáticos.
- **CAG** (context / cache augmentation): guardar contexto largo precomputado o en caché por sesión/tenant para no re-embedear todo cada vez. Desk ya cachea tenant/bot en KV; RAG por mensaje sigue siendo búsqueda vectorial.
- **KAG** (knowledge graphs): relaciones explícitas (producto → proveedor → norma). No está en Desk hoy; encaja si un cliente necesita razonamiento multi-entidad muy estructurado (futuro: grafo + RAG).
- **Routing**: clasificación **en código** (`intent-router.ts`) antes del LLM: saludo sin modelo, commerce tools solo en browse/order/carrito; RAG sigue por mensaje con query enriquecida (`ragQueryForUserMessage`). Mejora futura: clasificador barato para intenciones ambiguas.

## Arnés del agente (harness)

**No confundir** con **Harness 2 (comercio)** — ver [adr/harness-2-commerce.md](./adr/harness-2-commerce.md) vs [adr/visitor-intent-router.md](./adr/visitor-intent-router.md).

El modelo solo es una pieza; Desk implementa un **arnés** alrededor:

| Pieza | Implementación |
|--------|----------------|
| Router de intención | `intent-router.ts` — saludo local, commerce condicional por turno |
| Catálogo MCP en D1 | `bot_mcp_tool_catalog` — sin `tools/list` en cada mensaje |
| Tools al LLM | Ranking rápido, router KV, o fase `harness_search_tools` / `harness_select_tools` + hidratación (`agent.ts`) |
| Skills en prompt | Resumen en visitante/setup; cuerpo con `desk_skill_read` (admin) |
| Verificación setup | Tras mutaciones, el runtime exige `desk_workspace_status` o probe antes de cerrar |
| Flags | `HARNESS_LAZY_TOOLS`, `HARNESS_SETUP_VERIFY`, `HARNESS_COMPACT_HISTORY`, `HARNESS_ROUTER` |

Métricas opcionales: dataset Analytics `desk_events` (`harness/metrics.ts`).

## Optimización de tokens y latencia

- Top-K bajo en RAG y contexto recortado (`docs/COST_PER_MESSAGE.md`).
- **Caché RAG** en la conversación (misma pregunta ~2 min, sin re-embed).
- **Ranking de herramientas**: si hay muchas, solo las ~8 schemas hidratadas van al LLM (`tool-rank.ts`, `tool-catalog.ts`).
- Descripciones de herramientas acotadas (~800 chars).
- Máximo ~5 vueltas tool-call por mensaje.
- Instrucciones del tenant: mejor calidad que tamaño; la capa Desk es fija y compacta.
- Pendiente: clasificador LLM barato para `general` ambiguo, prompt caching del proveedor, stream post-tools, OpenTelemetry por turno.

## UI generativa (`@chatbot/chat-ui`)

Varios bloques `desk-ui` por mensaje: productos, choices, árbol `gen`, HTML sanitizado, `host` (componentes reales de la web vía `DeskHost`). Ver `docs/SALES_AND_CHAT_ROADMAP.md`.

## Cómo acercarse a “hablo con un humano que vende y resuelve”

1. **Instrucciones de empresa** con persona, límites y objetivos (venta consultiva, soporte técnico, etc.).
2. **Documentos** para lo estático; **integraciones** para stock, pedidos, clientes.
3. Pedir al modelo que use **`desk-ui`** cuando muestre opciones o productos (ver `persona-prompt.ts`).
4. Más endpoints OpenAPI/HTTP = más acciones reales, no solo texto.
