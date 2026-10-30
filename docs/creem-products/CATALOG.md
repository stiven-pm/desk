# Catálogo Creem — Desk

Crea **cada fila dos veces** en Creem: una en **test** y otra en **live** (mismos nombre y precio; distinto `prod_…` en `.env.test` vs `.env.production`).

| # | Nombre en Creem | Variable `.env` | Tipo Creem | USD | Descripción (copiar) |
|---|-----------------|-----------------|------------|-----|----------------------|
| 1 | Desk Starter | `CREEM_PRODUCT_STARTER` | **Suscripción** · mensual | **89** | [desk-starter.md](./desk-starter.md) |
| 2 | Desk Growth | `CREEM_PRODUCT_GROWTH` | **Suscripción** · mensual | **189** | [desk-growth.md](./desk-growth.md) |
| 3 | Desk Business | `CREEM_PRODUCT_BUSINESS` | **Suscripción** · mensual | **579** | [desk-business.md](./desk-business.md) |
| 4 | Desk Créditos 25k | `CREEM_PRODUCT_CREDITS_25` | **Pago único** (one-time) | **25** | [desk-credits-25k.md](./desk-credits-25k.md) |
| 5 | Desk Créditos 55k | `CREEM_PRODUCT_CREDITS_50` | **Pago único** (one-time) | **50** | [desk-credits-55k.md](./desk-credits-55k.md) |
| 6 | Desk Créditos 120k | `CREEM_PRODUCT_CREDITS_100` | **Pago único** (one-time) | **100** | [desk-credits-120k.md](./desk-credits-120k.md) |

## Metadata en checkout (suscripciones)

Desk guarda `plan_slug` en `pending_payments` vía `request_id` (`DESK-…`). No depende del nombre del producto en Creem, pero conviene que el **nombre** coincida con la tabla para soporte.

Wallet: `payment_kind=wallet` + pack `25` | `50` | `100` — requiere productos one-time y vars `CREEM_PRODUCT_CREDITS_*`.

## Webhooks

| Entorno | URL |
|---------|-----|
| Test | `https://api-test-desk.rekov.co/webhooks/creem` |
| Prod | `https://api-desk.rekov.co/webhooks/creem` |

## Secrets (no van en wrangler vars)

`CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET` → `npm run desk:secrets:test` / `desk:secrets:prod`
