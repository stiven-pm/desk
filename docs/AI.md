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
