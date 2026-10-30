# Desk — precios y economía (referencia)

Producto **chat web + tienda hosted**. Precios públicos y copy en `packages/domain/src/marketing.ts`.

## Planes (USD/mes, todo incluido)

| Plan | Precio | Mensajes/mes | Créditos/mes |
|------|--------|--------------|--------------|
| Starter | **99** | 2 500 | 50 000 |
| Growth | **199** | 12 000 | 120 000 |
| Business | **589** | 50 000 | 480 000 |

Cada plan incluye chat web hosted, mensajes de visitantes y créditos de procesamiento según la tabla.

## COGS interno (planificación)

- Fijo por org: `ECONOMICS_FIXED_USD_PER_ORG` en `packages/domain/src/economics.ts`
- Variable IA: `docs/COST_PER_MESSAGE.md` y bandas `ECONOMICS_USD_PER_1K_CREDITS`
- Creem: ~4% + USD 0,30 por cobro

Margen de referencia: `estimateOrgGrossMarginUsd()`.

## Creem y add-ons

Ver **`docs/CREEM_AND_PRICING.md`** (productos `CREEM_PRODUCT_*`, packs de créditos, qué no está cableado).

## Límites

`packages/domain/src/plans.ts` — bots, asientos, fuentes RAG, integraciones.
