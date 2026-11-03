# Desk — precios (referencia)

Producto **chat web + tienda hosted + bandeja**. Copy público: `packages/domain/src/marketing.ts`.

## Planes (USD/mes)

| Plan | Precio | Mensajes/mes | Créditos/mes |
|------|--------|--------------|--------------|
| Starter | **99** | 2 500 | 50 000 |
| Growth | **199** | 12 000 | 120 000 |
| Business | **589** | 50 000 | 480 000 |

Incluye chat hosted, procesamiento IA (modelo + documentos + tools) y límites de asientos/bots/RAG en `plans.ts`.

## Economía y venta

| Doc | Contenido |
|-----|-----------|
| `UNIT_ECONOMICS.md` | Márgenes stress por plan, bandas Ops, error Business/1.10 |
| `COST_PER_MESSAGE.md` | Desglose Cloudflare por mensaje |
| `POSITIONING.md` | ICP, sí/no, brechas (catálogo panel, Creem wallet) |
| `CREEM_AND_PRICING.md` | SKUs Creem |

COGS y márgenes: solo `economics.ts` + Ops (`requireOps`) + docs internos — **nunca** en `/dashboard` ni APIs `/v1/admin/*` para tenants.
