# Creem ↔ Desk

## Pantalla “Crear tienda” (Creem)

| Campo | Qué poner |
|-------|-----------|
| **Nombre de la tienda** | `desk` (o `Desk`) — slug público `creem.io/desk`. |
| **¿Qué estás vendiendo?** | **Software / SaaS** (principal). Opcional marcar también **IA generativa** si Creem lo permite en multi-select. |
| **URL del sitio** | **`https://desk.rekov.co`** — landing, precios y legal (público). El panel es `/login`; Creem debe ver producto y planes, no solo un formulario. |

La tienda es la **marca de facturación**; los planes se crean después como **productos** dentro de esta tienda.

## Dos mundos: test vs producción

| | Test (desarrollo) | Producción |
|--|-------------------|------------|
| API | `https://test-api.creem.io/v1` | `https://api.creem.io/v1` |
| `.env` | `.env.test` | `.env.production` |
| Webhook | `https://api-test-desk.rekov.co/webhooks/creem` | `https://api-desk.rekov.co/webhooks/creem` |
| Checkout success | `APP_URL` → `https://test-desk.rekov.co/billing/success` | `https://desk.rekov.co/billing/success` |

Usa **modo test de Creem** para los 3 productos de prueba y **modo live** para los 3 de prod (misma tienda o dos tiendas; lo habitual es una tienda con productos test/live según dashboard Creem).

## Productos en Creem

### Suscripción mensual (3 obligatorios × test + live)

Precios alineados con `marketing.ts` (ver `docs/PRICING_AND_CREEM_AUDIT.md`).

| Producto en Creem | `plan_slug` | Variable `.env` | USD/mes |
|-------------------|-------------|-----------------|---------|
| Desk Starter | `starter` | `CREEM_PRODUCT_STARTER` | 89 |
| Desk Growth | `growth` | `CREEM_PRODUCT_GROWTH` | 189 |
| Desk Business | `business` | `CREEM_PRODUCT_BUSINESS` | 579 |

### Pago único — créditos wallet (3 × test + live)

| Producto | Variable | USD | Créditos |
|----------|----------|-----|----------|
| Desk Credits 25k | `CREEM_PRODUCT_CREDITS_25` | 25 | 25 000 |
| Desk Credits 55k | `CREEM_PRODUCT_CREDITS_50` | 50 | 55 000 |
| Desk Credits 120k | `CREEM_PRODUCT_CREDITS_100` | 100 | 120 000 |

En la descripción de cada producto puedes copiar límites de [PRODUCT.md](./PRODUCT.md) (mensajes, bots, RAG, etc.). El **precio USD** solo lo defines en Creem.

**Importante:** si acabas de crear la tienda **desk** en Creem, los `prod_…` que vienen de **Flatbase** en `.env` **no sirven**. Crea 3 productos nuevos en la tienda Desk y pega sus IDs en `.env.test` / `.env.production`.

## Webhook vs pantalla de éxito

Creem redirige al usuario a `APP_URL/billing/success?ref=DESK-…` **antes** de que el webhook llegue siempre. Desk hace lo mismo que Flatbase:

1. **Webhook** `POST /webhooks/creem` → activa la org (`status = active`).
2. **Poll** en la pantalla de éxito: `GET /v1/admin/billing/payment-status?ref=…` cada 2s; si el webhook no llegó, consulta el checkout en Creem y activa igual.

Sin webhook configurado en test, el poll suele bastar; en producción conviene tener **ambos**.

## Qué configurar en Creem (dashboard)

1. **API key** → `CREEM_API_KEY` en `.env` (test key en test, live en prod).
2. **Webhook**
   - URL test o prod (tabla arriba).
   - Secret → `CREEM_WEBHOOK_SECRET`.
   - Eventos: pago / checkout completado (lo que envíe `paid` o `completed` en el payload; el Worker activa la org).
3. **Productos** → copiar cada `product_id` a las tres variables `CREEM_PRODUCT_*`.

Luego:

```bash
npm run desk:secrets:test    # o prod
npm run desk:deploy:test
```

## Qué hace Desk (código)

- Org nueva suele estar `status != active` hasta pagar.
- Panel: botones Starter / Growth / Business → `POST /v1/admin/billing/checkout` con `{ "plan": "starter" | "growth" | "business" }`.
- Checkout lleva metadata: `org_id`, `plan_slug`.
- Webhook `POST /webhooks/creem`: firma HMAC con `CREEM_WEBHOOK_SECRET` → `orgs.status = active`, `plan_slug` actualizado.

Límites de uso (créditos, mensajes, bots, RAG) vienen de `packages/domain/src/plans.ts`, **no** de Creem. Creem solo cobra; Desk aplica caps.

## Checklist rápido

- [ ] Tienda Creem `desk` creada (SaaS + URL `https://desk.rekov.co`)
- [ ] 3 productos mensuales (Starter, Growth, Business) en **test** y en **live**
- [ ] Webhook test → API test; webhook prod → API prod
- [ ] `.env.test` / `.env.production` con API key, webhook secret, 3 product IDs, `CREEM_API_BASE_URL` correcto
- [ ] `desk:secrets:*` + deploy API desplegada
- [ ] Probar checkout desde `test-desk` con org de prueba
