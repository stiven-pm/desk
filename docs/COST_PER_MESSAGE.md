# Coste real por mensaje (Desk en Cloudflare)

Fuentes de precio (verificar en dashboard; última revisión doc **oct 2026**):

- [Workers AI — pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [GLM-5.3-Flash](https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/) — **$0.15 / M input**, **$0.50 / M output**
- [BGE-M3](https://developers.cloudflare.com/workers-ai/models/bge-m3/) — **$0.0118 / M input** (solo entrada; sin output)
- [Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/) — **$0.01 / millón de dimensiones consultadas** (+ almacenamiento; 50M dims consultadas/mes incluidas en Workers Paid)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/) — requests **$0.15 / M** (+ duración GB-s si el DO no hiberna)
- [Workers](https://developers.cloudflare.com/workers/platform/pricing/) — requests incluidos en plan Paid (~10M/mes)
- [R2](https://developers.cloudflare.com/r2/pricing/) — **no** en cada mensaje de chat (solo ingesta / descarga de PDF)

Modelos en prod: `docs/AI.md` — `@cf/zai-org/glm-5.3-flash` + `@cf/baai/bge-m3` (1024 dims).

## Qué hace Desk en **un** mensaje de usuario (RAG típico)

```text
Cliente → Worker API → Conversation DO
  → embed pregunta (BGE-M3)
  → Vectorize topK=4 (índice compartido, filtro org_id en metadata)
  → chat GLM-5.3-Flash (system + contexto RAG recortado + user, max ~1200 tokens salida)
  → D1 usage + DO SQLite (historial)
```

**No** se lee R2 en cada mensaje. El embedding de **ingesta** (PDF → chunks 800 chars) es coste **único por documento**, no por mensaje.

## Créditos Desk vs coste real (hueco actual)

En código, el contador de créditos usa **solo tokens del chat** (`prompt_tokens` + `completion_tokens × 4`), **no** embedding ni Vectorize:

`packages/runtime/src/conversation-do.ts` → `mapLlmResult`.

`CREDIT_WEIGHTS.embeddingPer1k` en `packages/domain/src/credits.ts` **no se aplica** hoy en runtime.

Para economía y wallet, asume que el coste real por mensaje ≈ **chat + 1× embed query + 1× Vectorize query + DO/Worker/D1**.

### Herramientas en el prompt (agente visitante)

- Integraciones HTTP/MCP se cargan desde D1; al modelo van **todas las `commerce_*`** cuando hay tienda activa, más **hasta 5** HTTP/MCP solo si el mensaje tiene señal (`MAX_HTTP_TOOLS_PER_TURN` en `tool-rank.ts`).
- No hay fase discovery LLM ni schemas completos del bot en cada turno.
- Un turno difícil puede hacer **varias** llamadas Workers AI (bucle tools + escalera en `agent-llm-turn.ts`); ver logs `desk_agent_llm_attempt` / `desk_llm_ladder` y [AI.md](./AI.md).

---

## Estimación por componente (USD / mensaje)

### 1) Embedding de la pregunta (BGE-M3)

| Supuesto | Tokens entrada | Coste |
|----------|----------------|-------|
| Pregunta corta | ~40 | 40 / 1e6 × $0.0118 ≈ **$0.0000005** |
| Pregunta larga | ~200 | ≈ **$0.000002** |

Casi despreciable frente al chat; **no** lo ignores en agregado (millones de msgs), pero no mueve el margen solo.

### 2) Vectorize

Cloudflare agrega en el mes: **dimensiones consultadas ≈ (N vectores almacenados + Q queries) × dims** ([pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)).  
Desk: **1024** dims, `topK = 4`.

| Escala (ejemplo plataforma) | Coste Vectorize/mes (orden) |
|-----------------------------|-----------------------------|
| PYME, dentro del free tier Paid | **$0** |
| Producción CF doc (~200k queries, 50k vectores, 768 dims) | **~$2** |
| Índice XL CF doc | **~$23/mes** total índice |

**Marginal por query extra** (cuando ya pagas overage): sube el contador **+1024 dims/query**, no **N×1024 por query**. La tabla antigua “$0.51/query con N=50k” era **incorrecta**.

Asignación stress por org en planning: `STRESS_VECTORIZE_USD_PER_ORG` en `economics.ts`.

### 3) Chat (GLM-5.3-Flash — prod)

List price: **$0.15 / M input**, **$0.50 / M output** ([modelo](https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/)).

| Escenario | Input | Output | Coste chat |
|-----------|-------|--------|------------|
| RAG moderado | ~2 000 | ~350 | **~$0.00048** |
| Cerca de `CHAT_DEFAULT_MAX_TOKENS` (1200 out) | ~2 500 | ~1 200 | **~$0.00098** |
| Agente + tools (varias llamadas) | ~6 000 × 6 calls | ~1 800 × 6 | **~$0.011** / mensaje visitante |

Alternativa DeepSeek en CF (no default Desk): `@cf/deepseek-ai/deepseek-v4.1-flash-1017` — otros $/M; cambiar solo si cambias `WORKERS_AI_CHAT_MODEL`.

### 4) DO + Worker API + D1 (por mensaje)

| Partida | Orden de magnitud |
|---------|-------------------|
| DO request(s) HTTP/WS (ratio 20:1 en WS) | **$0.00001 – $0.0001** |
| DO duration (si WebSocket abierto segundos–minutos) | **$0 – $0.002** por sesión activa (no por mensaje aislado HTTP) |
| Worker API + D1 reads/writes usage | **< $0.00005** |

### 5) “3 webs” (dashboard + ops + API)

No son **3× coste por mensaje**. El visitante solo golpea **API + DO**. Dashboard y Ops son:

- **Tráfico humano** (HTML/JS, `/v1/admin/*` sin IA) → centavos/mes por org salvo abuso.
- **Ops inspeccionando** → D1 listados; irrelevante frente a IA.

Amortizar plan Workers **$5/mes** (mínimo Paid) + dominios:

| Msgs plataforma / mes | Overhead fijo / msg (solo Workers $5) |
|-----------------------|----------------------------------------|
| 5 000 | **$0.001** |
| 20 000 | **$0.00025** |
| 100 000 | **$0.00005** |

R2: almacenar PDFs (ej. 100 orgs × 25 archivos × 2 MB) ≈ 5 GB → **~$0.08/mes** storage; operaciones de ingesta aparte (embed por chunk).

---

## Total **USD / mensaje** (chat RAG, sin tools)

| Perfil | IA (embed+chat) | Infra | **Total** |
|--------|-----------------|-------|-----------|
| **Típico** | ~$0.0005 – 0.001 | ~$0.0001 | **~$0.001** |
| **Pesado (tools, varias LLM)** | ~$0.008 – 0.012 | ~$0.0002 | **~$0.01 – 0.012** |

En **créditos Desk** (~8–34 créditos/msg según perfil): el contador puede **subestimar** tools si no calibras bandas — usar factura CF + `usageCreditsPerMessageMonthMean` en Ops.

**Wallet retail:** packs ≥ **$1/1k créditos** al cliente; tu coste GLM típico **≪ $0.55/1k** en tokens — margen en packs si Creem mínimo ~$25.

---

## Ingesta (no es por mensaje, pero usa los mismos modelos)

Por chunk (~800 chars ≈ 200 tokens):

- Embed BGE-M3: 200 / 1e6 × $0.0118 ≈ **$0.0000024**
- Vectorize upsert: almacenamiento dims (amortizado mensual)

Ejemplo: PDF → 40 chunks → **~$0.0001** IA embed + storage Vectorize despreciable al inicio.

---

## Acciones recomendadas (ingeniería + precio)

1. **Medir en test:** 100 mensajes reales → Workers AI analytics + Vectorize dashboard → sustituir tablas de arriba.
2. **Metering:** sumar a créditos por mensaje: `+1` crédito fijo (embed) + `f(N_vectorize)` o tabla por plan.
3. **Vectorize:** planificar partición por org o por índice cuando N global > ~10k vectores.
4. **Wallet PAYG:** precio retail ≥ **2×** coste total de la fila “Típico” (~$0.023) → **≥ $0.05/msg** equivalente o **≥ $1.00 / 1k créditos** con créditos honestos (~20 créditos/msg).

Ver diseño de producto: `docs/WALLET_PAYGO.md`.
