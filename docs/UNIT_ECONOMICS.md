# Unit economics — Desk

**Documento interno Rekov.** No va al panel del cliente ni a la web pública. Los tenants solo ven precio del plan, mensajes/créditos incluidos y su uso.

Fuente de verdad comercial (público): `packages/domain/src/marketing.ts` + `plans.ts`.  
Fuente de verdad COGS: list price Cloudflare ([Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/)) + `packages/domain/src/economics.ts` (Desk Ops).

Modelo chat prod: **`@cf/zai-org/glm-5.3-flash`** ($0.15/M in, $0.50/M out) + **`@cf/baai/bge-m3`** (~$0.012/M in). Ver `docs/AI.md`.

## Planes (USD/mes)

| Plan | Precio | Mensajes/mes | Créditos/mes | Asientos | Bots |
|------|--------|--------------|--------------|----------|------|
| Starter | **99** | 2 500 | 50 000 | 3 | 1 |
| Growth | **199** | 12 000 | 120 000 | 10 | 5 |
| Business | **589** | 50 000 | 480 000 | 35 | 25 |

Creem: **4% + $0.30** por cobro (`creemFeeUsd()`).

## Dos formas de estimar margen (no confundir)

| Método | Cuándo usarlo | Código |
|--------|---------------|--------|
| **Uso real del mes** | Ops día a día: MRR activo vs créditos medidos en D1 | `estimateOrgGrossMarginUsd(snap, "realisticAllIn")` |
| **Stress por plan** | “¿Pierdo si maxean?” — techo por **créditos**, mensaje caro fijo | `estimatePlanStressMarginUsd()` → `PLAN_STRESS_MARGINS` |

### Error que confundía a Business

Multiplicar **100% del cupo de créditos** × **$1.10/1k** (`linearCreditCeiling`) hace ver Business en rojo aunque Cloudflare no cobre así. Esa banda solo sirve como **alarma** si el contador de créditos queda muy por debajo de la factura real.

El techo operativo suele ser **créditos antes que mensajes** (mensaje pesado ≈ **34 créditos** → `STRESS_CREDITS_PER_VISITOR_MESSAGE`).

## Escenario stress (único, pesimista coherente)

Por org/mes, asumiendo solo mensajes “caros” hasta agotar créditos:

- **6 llamadas** GLM-5.3-Flash × (~6k in + ~1.8k out) → **~$0.0108 / mensaje** (`STRESS_LLM_USD_PER_VISITOR_MESSAGE`)
- Vectorize plataforma compartida asignada: **$15 / $40 / $120** (`STRESS_VECTORIZE_USD_PER_ORG`)
- Infra fija planificada: **$4.50 / $13 / $40** (`ECONOMICS_FIXED_USD_PER_ORG`)
- Creem sobre precio del plan

| Plan | Msgs stress (tope créditos) | **Margen bruto stress (USD/mes)** |
|------|----------------------------|-----------------------------------|
| Starter | ~1 470 | **~$59** |
| Growth | ~3 529 | **~$101** |
| Business | ~14 117 | **~$258** |

**Business gana más en dólares**, no menos. El % sobre MRR baja un poco porque incluye más cupo.

## Bandas $ / 1k créditos medidos (uso real)

Calibradas a GLM Flash + RAG metered; no sustituyen la reconciliación con factura CF en Ops → Salud.

| Banda | USD/1k | Notas |
|-------|--------|-------|
| `optimistic` | 0.22 | Respuestas cortas |
| `chatTokensOnly` | 0.32 | Solo contador tokens chat |
| `realisticAllIn` | **0.45** | Default Ops |
| `pessimistic` | 0.55 | Tools + respuestas largas |
| `linearCreditCeiling` | 1.10 | Legacy / alerta — no usar para decidir precios |

## Venta vs economía

| Pregunta | Respuesta corta |
|----------|-----------------|
| ¿Planes bien en COGS? | Sí con GLM Flash y cupos actuales |
| ¿Business inviable? | No — el rojo era la fórmula lineal 1.10/1k |
| ¿Compiten en $29 widget? | No — ICP: web + pedidos repetitivos + precio fijo |
| ¿Qué falta para vender? | Catálogo nativo en panel, overage Creem productos en prod, casos piloto — ver `POSITIONING.md` |

## Pay-as-you-go

Wallet + checkout en código; falta productos one-time Creem en `.env` (`docs/WALLET_PAYGO.md`). Packs: `WALLET_CREDIT_PACKS` en `economics.ts`.

## Ops

- **Métricas / Salud (Ops auth):** uso agregado y estimados internos — **no** replicar márgenes en marketing  
- **Salud:** reconciliación `CF_BILLING_API_TOKEN` vs estimado Desk  
- **Calibración trimestral:** comparar factura Workers AI con créditos/msg medios (`usageCreditsPerMessageMonthMean`)
