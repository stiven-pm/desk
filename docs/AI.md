# Desk — IA con Cloudflare Workers AI

## Sin API keys de OpenAI / DeepSeek externas

La IA corre en **Workers AI** (binding `AI` en el Worker). Se factura en tu cuenta Cloudflare; los **clientes Desk no configuran keys de LLM**.

## Modelos por defecto

| Uso | Variable | Default |
|-----|----------|---------|
| Chat / razonamiento | `WORKERS_AI_CHAT_MODEL` | `@cf/zai-org/glm-5.3-flash` |
| Embeddings (RAG) | `WORKERS_AI_EMBEDDING_MODEL` | `@cf/baai/bge-m3` |
| Dimensión Vectorize | `EMBEDDING_DIMENSIONS` | `1024` (BGE-M3) |

Alternativas (solo cambia la var en `.env` y redeploy), por ejemplo:

- `@cf/deepseek-ai/deepseek-v4.1-flash-1017` — alternativa DeepSeek
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` — más razonador, más lento/caro en neurona
- `@cf/qwen/qwq-32b` — razonamiento
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — contexto amplio
- `@cf/baai/bge-base-en-v1.5` — embeddings más baratos (768 dims → cambiar índice Vectorize)

## Flujo

```text
PDF → R2 → cola → BGE-M3 (ingesta) → Vectorize
Chat → WebSocket → ConversationDO → BGE-M3 (query) → Vectorize → GLM-5.3-Flash → stream al cliente
```

- **Durable Object**: conversación + llamadas a Workers AI.
- **Vectorize**: chunks con `org_id` en metadata.
- **Timeout**: `LLM_REQUEST_TIMEOUT_MS` (default 45s).
- **Streaming**: `LLM_STREAM_ENABLED=true` (default).

## Vectorize

El índice debe crearse con **1024 dimensiones** si usas BGE-M3. Si cambias modelo de embedding, recrea el índice o usa un índice nuevo con la dimensión correcta.

## Deploy

No hace falta `LLM_API_KEY` en secrets. Solo:

```bash
npm run desk:deploy:test
```

El runtime envía `reasoning_effort: low` en GLM-5.3-Flash (el default del modelo en CF es `max`).

Opcional en `.env.test` / producción para override de modelos:

```bash
WORKERS_AI_CHAT_MODEL=@cf/zai-org/glm-5.3-flash
WORKERS_AI_EMBEDDING_MODEL=@cf/baai/bge-m3
EMBEDDING_DIMENSIONS=1024
```

## Checkout agente (flags Worker)

Por defecto desactivados (`0`). En `.env.test` / `.env.production` antes de `desk:deploy:*`:

```bash
AGENT_FLOW_TOOLS=1          # tools commerce_view_cart, commerce_provide_buyer_fields, …
AGENT_DRIVEN_WIZARD=1       # prosa libre en wizard comprador → LLM (requiere flow tools)
```

Sin `AGENT_FLOW_TOOLS`, el nativo sigue manejando clicks y las interrupciones fijas (`show_cart`, corrección tel/email/nombre).

## Agente visitante (bucle OpenClaw-like)

- **Herramientas:** tres planos — (1) **integraciones por plantilla** (`integration_operations` → tools LLM; ERP/CRM/Excel/API sin tocar código), (2) **pasarelas** vía capabilities `payment.*` en la misma plantilla, (3) **`commerce_*` opcional** solo tienda nativa Desk (carrito/checkout firmado). HTTP/MCP legacy o instancia Desk; ranking por overlap de tokens (máx. 5) + meta-tools `desk_search_integrations` / `desk_call_integration` si el catálogo no cabe en schema.
- **Fallo LLM:** escalera en `agent-llm-turn.ts` — reintento con más `max_tokens`, suffix de tools (paso 3), luego chat sin tools (`degraded: true`, paso 4). Con tools en el turno, prosa sin `tool_calls` no cierra en paso 1. El mensaje «Tuve un problema técnico…» solo si agota la escalera (`agentTurnFailureOrRescue`).
- **Fallo de tool:** el JSON del error vuelve al modelo; tres errores iguales inyectan una pista de system y otra ronda.
- **Tool calls en prosa:** si GLM devuelve JSON embebido en lugar de `tool_calls` nativos, `llm-client.ts` parsea solo la salida del asistente y solo nombres del allowlist del turno; log `desk_tool_parsed_from_text`. No quitar hasta medir (&lt; 2 % de turnos con tools).

### Logs (prod / tail)

| Tag | Uso |
|-----|-----|
| `desk_agent_llm_attempt` | Cada llamada Workers AI (modelo, tools, duración, finish_reason) |
| `desk_llm_ladder` | Paso 1–3 de la escalera |
| `desk_agent_turn_rescue` | Último recurso tras fallo total |
| `desk_llm_empty_response` | Respuesta vacía del proveedor |
| `desk_tool_parsed_from_text` | Tool call recuperada del texto del asistente (no `tool_calls` nativos); incluye `toolNames`, `model`, `botId`, `conversationId` |

`DESK_LLM_DEBUG=1` (solo test): trunca request/response en `desk_llm_debug`.

### Dónde medir (hoy)

| Qué | Ops (`/metrics`, `/orgs/:id`) | Panel tenant (`/v1/admin/analytics`) | Worker logs / tail |
|-----|--------------------------------|--------------------------------------|---------------------|
| MRR, créditos, mensajes mes, COGS | Sí (global) | Uso del plan | — |
| Margen / wallet por org | Sí (por org) | — | — |
| Conversaciones, handoffs, checkout | — | Sí (por org) | — |
| Escalera LLM, vacíos, parser, intentos | **No** (aún) | **No** | Sí — tags arriba |
| Replay multi-modelo | — | — | Local: `scripts/replay-llm.mjs` + payload de `DESK_LLM_DEBUG` |

**Regla parser:** `count(desk_tool_parsed_from_text) / count(turnos con tools)` &lt; 2 % una semana → candidato a quitar parser; si no, mantener.

Analytics Engine `desk_events` (`harness/metrics.ts`) solo registra fase execute + conteos de tools por turno (índice `botId`), no sustituye los logs LLM.

### Comparar modelos

Captura un payload con debug y ejecuta:

```bash
REPLAY_MODELS=@cf/zai-org/glm-5.3-flash,@cf/deepseek-ai/deepseek-v4-flash-0731 \
CF_ACCOUNT_ID=... CF_API_TOKEN=... \
node --env-file=.env.test scripts/replay-llm.mjs payload.json
```
