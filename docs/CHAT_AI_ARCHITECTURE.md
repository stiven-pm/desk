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
- **Routing**: `classifyVisitorTurn` devuelve `small_talk` (mensaje vacío) o `general`; el resto lo resuelve el agente con tools y contexto de sesión. Ver `intent-router.ts`.

## Arnés del agente (visitante)

**No confundir** con **Harness 2 (comercio)** — ver [adr/harness-2-commerce.md](./adr/harness-2-commerce.md) vs [adr/visitor-intent-router.md](./adr/visitor-intent-router.md).

El modelo es una pieza; Desk implementa un **bucle de agente** alrededor (detalle en [AI.md](./AI.md)):

| Pieza | Implementación |
|--------|----------------|
| Nativo firmado | `tryNativeCommerceTurn` — botones `__desk:*` / `desk.act.v1` antes del LLM |
| Router de intención | `intent-router.ts` — `small_talk` vs `general`; commerce tools si hay tienda/carrito/catálogo |
| Catálogo MCP en D1 | `bot_mcp_tool_catalog` — sin `tools/list` en cada mensaje |
| Tools al LLM | Siempre `commerce_*` cuando hay commerce; HTTP/MCP rankeadas (máx. 5) solo con señal en el mensaje (`tool-rank.ts`, `agent.ts`) |
| Bucle multi-ronda | Hasta ~8 rondas; errores de tool vuelven al modelo; escalera LLM si el proveedor devuelve vacío (`agent-llm-turn.ts`) |
| Skills en prompt | Resumen en visitante; cuerpo con `desk_skill_read` (admin setup) |
| Verificación setup | Tras mutaciones en panel, `desk_workspace_status` / probe (`HARNESS_SETUP_VERIFY`) |
| Flags visitante | `AGENT_FLOW_TOOLS`, `AGENT_DRIVEN_WIZARD` — checkout agente |
| Flags ops | `HARNESS_SETUP_VERIFY`, `HARNESS_COMPACT_HISTORY` |

Métricas opcionales: Analytics `desk_events` (`harness/metrics.ts`). Logs: `desk_agent_llm_attempt`, `desk_llm_ladder`, `desk_agent_turn_rescue`.

## Optimización de tokens y latencia

- Top-K bajo en RAG y contexto recortado (`docs/COST_PER_MESSAGE.md`).
- **Caché RAG** en la conversación (misma pregunta ~2 min, sin re-embed).
- **Ranking de herramientas**: como mucho **5** schemas HTTP/MCP por turno si el mensaje alinea; sin discovery LLM extra.
- Descripciones de herramientas acotadas (~800 chars).
- Máximo ~8 vueltas tool-call por mensaje (`runAgentWithTools`).
- Capa Desk (`persona-prompt.ts`) compacta; tenant = skill de negocio.
- Pendiente: perfil allow/deny por bot (D1), routing de modelo por fase checkout, eval de conversaciones repetible.

## UI generativa (`@chatbot/chat-ui`)

Varios bloques `desk-ui` por mensaje: productos, choices, árbol `gen`, HTML sanitizado, `host` (componentes reales de la web vía `DeskHost`). Ver `docs/SALES_AND_CHAT_ROADMAP.md`.

## Cómo acercarse a “hablo con un humano que vende y resuelve”

1. **Instrucciones de empresa** con persona, límites y objetivos (venta consultiva, soporte técnico, etc.).
2. **Documentos** para lo estático; **integraciones** para stock, pedidos, clientes.
3. Pedir al modelo que use **`desk-ui`** cuando muestre opciones o productos (ver `persona-prompt.ts`).
4. Más endpoints OpenAPI/HTTP = más acciones reales, no solo texto.
