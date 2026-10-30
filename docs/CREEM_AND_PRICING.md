# Creem, precios públicos y add-ons

Última alineación: **Starter USD 99 · Growth USD 199 · Business USD 589** (todo incluido: plataforma + **1 número WhatsApp API** / slot WasapFlow). Los precios en código viven en `packages/domain/src/marketing.ts`.

## Qué hacer en Creem (panel creem.io)

### Suscripciones (obligatorio)

Edita **cada producto** ligado a `CREEM_PRODUCT_*` en `.env.production`:

| Variable env | Plan | Precio Creem (USD/mes) |
|--------------|------|-------------------------|
| `CREEM_PRODUCT_STARTER` | Starter | **99** |
| `CREEM_PRODUCT_GROWTH` | Growth | **199** |
| `CREEM_PRODUCT_BUSINESS` | Business | **589** |

- Tipo: **recurring / subscription**.
- Moneda: **USD**.
- Descripción sugerida: incluye 1 línea WhatsApp Business API (infra partner), mensajes y créditos según plan; **Meta factura mensajes aparte** en el Business Manager del cliente.
- Tras cambiar precio en Creem **no** hace falta cambiar el `prod_…` id salvo que crees productos nuevos; si creas productos nuevos, actualiza las variables y `npm run desk:secrets:prod`.

### Packs de créditos (opcional, ya cableado)

| Variable | Retail | Créditos |
|----------|--------|----------|
| `CREEM_PRODUCT_CREDITS_25` | 25 | 25 000 |
| `CREEM_PRODUCT_CREDITS_50` | 50 | 55 000 (+10%) |
| `CREEM_PRODUCT_CREDITS_100` | 100 | 120 000 (+20%) |

Definición en `packages/domain/src/economics.ts` → `WALLET_CREDIT_PACKS`.

### Add-ons que **no** existen en Creem hoy

| Concepto | Estado en código | Recomendación |
|----------|------------------|---------------|
| **Asiento extra** (`SEAT_ADDON_USD` en economics) | Solo constante; **sin** `CREEM_PRODUCT_*` ni checkout | Crear producto Creem “Asiento extra” y cablear si vendes más de `maxSeats`. |
| **Segundo número WhatsApp** | No hay SKU | Nuevo producto **~USD 10/mes** (otro WABA / slot) o subir de plan. |
| **WasapFlow por separado** | **No** — va embebido en 99/199/589 | No crear línea aparte salvo que cambies estrategia. |

### Webhook

- URL producción: `https://api-desk.rekov.co/webhooks/creem` (o tu `PLATFORM_API_URL`).
- Secret: `CREEM_WEBHOOK_SECRET` (sync secrets).
- Eventos usados: `checkout.completed`, `checkout.paid`, suscripción activa (ver `packages/platform-api/src/routes/webhooks.ts`).

### Flujo usuario

1. Registro → onboarding plan → `POST /v1/admin/billing/checkout` con `plan` slug.
2. Creem cobra → webhook activa org (`status = active`, `plan_slug`).
3. **Conectar WhatsApp** (`connect-session`) debería exigir suscripción activa (middleware ya limita billing; reforzar en WA si hace falta).
4. Exceso de créditos → `POST /v1/admin/billing/wallet/checkout` con `pack`.

## WasapFlow (tu tarjeta, no Creem)

- Partner: [partner.wasapflow.com](https://partner.wasapflow.com) → Billing → tarjeta.
- **~USD 10/mes por slot de 3 WABAs**; coste planificado por cliente con 1 número: **~USD 3,33/mes** (`wasapflowUsdPerWabaMonth()` en economics).
- El retail **99/199/589** asume que recuperas ese coste dentro del plan.

## Meta (cliente)

- Método de pago en **su** WhatsApp Business / Billing Hub.
- Desk no cobra mensajes Meta vía Creem.

## Infra

| Flag | Prod |
|------|------|
| `NEXT_PUBLIC_WHATSAPP_CONNECT_ENABLED=1` | Panel WasapFlow en **WhatsApp**. |

Conectar número exige org `active` (`POST /v1/admin/whatsapp/connect-session` → `402 subscription_required`).

## Economía interna

- COGS mensual: `estimateOrgGrossMarginUsd()` en `economics.ts` (incluye WasapFlow ~3,33/org).
- Por mensaje: `docs/COST_PER_MESSAGE.md`.
