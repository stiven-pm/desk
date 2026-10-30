# Coste real por mensaje (Desk en Cloudflare)

Fuentes de precio (verificar en dashboard; última revisión doc **oct 2026**):

- [Workers AI — pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [DeepSeek V4 Flash](https://developers.cloudflare.com/workers-ai/models/deepseek-v4-flash-0731/) — **$0.44 / M input**, **$1.32 / M output**
- [BGE-M3](https://developers.cloudflare.com/workers-ai/models/bge-m3/) — **$0.0118 / M input** (solo entrada; sin output)
- [Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/) — **$0.01 / millón de dimensiones consultadas** (+ almacenamiento; 50M dims consultadas/mes incluidas en Workers Paid)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/) — requests **$0.15 / M** (+ duración GB-s si el DO no hiberna)
- [Workers](https://developers.cloudflare.com/workers/platform/pricing/) — requests incluidos en plan Paid (~10M/mes)
- [R2](https://developers.cloudflare.com/r2/pricing/) — **no** en cada mensaje de chat (solo ingesta / descarga de PDF)

Modelos en prod: `docs/AI.md` — `@cf/deepseek-ai/deepseek-v4-flash-0731` + `@cf/baai/bge-m3` (1024 dims).

## Qué hace Desk en **un** mensaje de usuario (RAG típico)

```text
Cliente → Worker API → Conversation DO
  → embed pregunta (BGE-M3)
  → Vectorize topK=4 (índice compartido, filtro org_id en metadata)
  → chat DeepSeek (system + contexto RAG recortado + user, max ~640 tokens salida)
  → D1 usage + DO SQLite (historial)
```

**No** se lee R2 en cada mensaje. El embedding de **ingesta** (PDF → chunks 800 chars) es coste **único por documento**, no por mensaje.

## Créditos Desk vs coste real (hueco actual)

En código, el contador de créditos usa **solo tokens del chat** (`prompt_tokens` + `completion_tokens × 4`), **no** embedding ni Vectorize:

`packages/runtime/src/conversation-do.ts` → `mapLlmResult`.

`CREDIT_WEIGHTS.embeddingPer1k` en `packages/domain/src/credits.ts` **no se aplica** hoy en runtime.

Para economía y wallet, asume que el coste real por mensaje ≈ **chat + 1× embed query + 1× Vectorize query + DO/Worker/D1**.

### Herramientas en el prompt (arnés)

- El visitante **no** envía el schema de todas las HTTP/MCP del bot: se cargan desde D1 (MCP catalog) y al modelo van **≤8** funciones hidratadas por turno (`MAX_SCHEMAS_PER_TURN`), o fase de descubrimiento con `harness_search_tools`.
- El coste dominante con integraciones gordas era repetir cientos de schemas cada turno; el arnés evita ese multiplicador (ver `docs/CHAT_AI_ARCHITECTURE.md`).

---

## Estimación por componente (USD / mensaje)

### 1) Embedding de la pregunta (BGE-M3)

| Supuesto | Tokens entrada | Coste |
|----------|----------------|-------|
| Pregunta corta | ~40 | 40 / 1e6 × $0.0118 ≈ **$0.0000005** |
| Pregunta larga | ~200 | ≈ **$0.000002** |

Casi despreciable frente al chat; **no** lo ignores en agregado (millones de msgs), pero no mueve el margen solo.

### 2) Vectorize (suele ser la sorpresa)

Cloudflare factura dimensiones consultadas por query. Regla documentada (índice con **N** vectores, **Q** queries en el periodo): escala con **(N + Q) × dimensiones** agregado; **por una query** en un índice grande el término dominante es **N × dims**.

Dimensión Desk: **1024**. `topK = 4`.

| Vectores en el índice (toda la plataforma en un solo índice) | Dimensiones ≈ (N+4)×1024 | Coste / query (sin free tier) |
|--------------------------------------------------------------|--------------------------|-------------------------------|
| 500 | ~0.52M | **~$0.005** |
| 2 000 | ~2.05M | **~$0.021** |
| 10 000 | ~10.2M | **~$0.10** |
| 50 000 | ~51M | **~$0.51** |

Con **50M dims consultadas/mes incluidas** en Workers Paid, muchas PYMEs no pagan Vectorize hasta escalar. A partir de ahí, **crece con el tamaño del índice global**, no solo con el plan del cliente.

**Riesgo producto:** un solo índice Vectorize para todos los tenants → el coste marginal por mensaje sube con el éxito de Desk. Mitigaciones (roadmap): índice por org, límites de chunks, o precio PAYG atado a “cost index tier”.

### 3) Chat (DeepSeek V4 Flash)

| Escenario | Input tokens | Output tokens | Coste chat |
|-----------|--------------|---------------|------------|
| Respuesta corta + RAG moderado | ~1 200 | ~180 | 0.0012×0.44 + 0.18×1.32 ≈ **$0.00076** |
| **Típico Desk** (system + ~2.5k chars RAG + user) | ~2 000 | ~350 | ≈ **$0.00134** |
| Respuesta larga (cerca del max 640 tokens) | ~2 500 | ~600 | ≈ **$0.0029** |
| Con tools / agente (Growth+) | ~4 000+ | ~500+ | **$0.004 – $0.012+** |

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

| Perfil | Vectorize (N vectores) | IA (embed+chat) | Infra | **Total** |
|--------|------------------------|-----------------|-------|-----------|
| **PYME temprana** | N≈500 → ~$0.005 | ~$0.001 | ~$0.0003 | **~$0.006 – 0.008** |
| **Típico** | N≈2k → ~$0.021 | ~$0.0013 | ~$0.0003 | **~$0.023** |
| **Plataforma mediana** | N≈10k → ~$0.10 | ~$0.0015 | ~$0.0002 | **~$0.10** |
| **Respuesta larga + N grande** | + | ~$0.004 | | **$0.12 – 0.55+** |

En **créditos Desk** hoy (solo chat, ~6–10 créditos/msg típico):

- Coste real **~$0.006 – 0.10** / msg
- Si traduces 8 créditos → $0.40/1k créditos ⇒ **$0.0032** coste “contable” interno → **subestimas** cuando Vectorize pesa.

**Regla práctica para wallet:** usa **$0.55 – $1.00 / 1 000 créditos Desk** como coste interno de planificación cuando el índice supera ~5k vectores, o baja N con índices por tenant.

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
