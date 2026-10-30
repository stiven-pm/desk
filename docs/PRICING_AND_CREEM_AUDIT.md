# Precios Desk + auditoría Creem (2026)

## Posicionamiento (sin voz / omnicanal)

Desk compite en **chat web + conocimiento + APIs/MCP + handoff humano**, con **cuota mensual clara**. No vendemos WhatsApp, voz ni licencias de agente tipo Intercom.

**Mensaje:** más valor por dólar que suites por resolución ($0.99–2/resolución) cuando el cliente automatiza mucho en la web.

Lista pública (fuente `packages/domain/src/marketing.ts` + límites en `plans.ts`):

| Plan | USD/mes | Mensajes cliente | Créditos proc. | Seats | Bots | RAG files |
|------|---------|------------------|----------------|-------|------|-----------|
| **Starter** | **89** | 2 500 | 50 000 | 3 | 1 | 20 |
| **Growth** | **189** | 12 000 | 120 000 | 10 | 5 | 40 |
| **Business** | **579** | 50 000 | 480 000 | 35 | 25 | 120 |

Ver definiciones: `docs/USAGE_METERING.md` (mensaje ≠ sesión).

**Mismo producto en todos los planes** (integraciones, MCP, bandeja). Solo cambia volumen y escala. Ver `docs/SCALE_AND_QUALITY.md`.

### Por qué Starter a $89

- Precio de **producto completo**, no “widget barato”.
- Cupos de conversación/asistentes acotados; margen sano si usan integraciones.
- Competencia por **valor** (RAG + APIs + handoff fijo), no por recortar funciones.

### Qué NO subir sin datos Ops

- Business por encima de **$549** hasta ver margen % en `/metrics`.
- Cupos Business (450k créditos) si Vectorize compartido se dispara.

### Seats extra (manual / roadmap Creem)

Sugerido en código (`SEAT_ADDON_USD`): Growth **$12/mes**, Business **$8/mes**. Hoy: **subir plan** o contrato manual. Producto Creem recurring “Desk seat add-on” pendiente.

---

## Productos que debes tener en Creem

### Suscripción mensual (obligatorio) — 6 productos (test + live)

| Nombre en Creem | Precio USD | Variable `.env` |
|-----------------|------------|-----------------|
| Desk Starter | **89** | `CREEM_PRODUCT_STARTER` |
| Desk Growth | **189** | `CREEM_PRODUCT_GROWTH` |
| Desk Business | **579** | `CREEM_PRODUCT_BUSINESS` |

Crea **3 en test-api** y **3 en live** (o duplica tienda según tu flujo Creem).

### Pago único — wallet (6 productos)

| Nombre | Precio | Créditos Desk | Variable |
|--------|--------|---------------|----------|
| Desk Credits 25k | **25** | 25 000 | `CREEM_PRODUCT_CREDITS_25` |
| Desk Credits 55k | **50** | 55 000 (+10%) | `CREEM_PRODUCT_CREDITS_50` |
| Desk Credits 120k | **100** | 120 000 (+20%) | `CREEM_PRODUCT_CREDITS_100` |

Tipo: **one-time** / pago único (no suscripción).

---

## Variables de entorno (checklist)

En `.env.test` y `.env.production`:

| Variable | Secret / var wrangler |
|----------|------------------------|
| `CREEM_API_KEY` | Secret (`desk:secrets:*`) |
| `CREEM_WEBHOOK_SECRET` | Secret |
| `CREEM_API_BASE_URL` | `https://test-api.creem.io/v1` o `https://api.creem.io/v1` |
| `CREEM_PRODUCT_*` (6 subs + 3 wallet) | Vars públicas en worker (render-wrangler) |

Wallet vars **opcionales** en render: si faltan, checkout de packs devuelve `billing_not_configured`.

---

## Webhooks Creem

| Entorno | URL |
|---------|-----|
| Test | `https://api-test-desk.rekov.co/webhooks/creem` |
| Prod | `https://api-desk.rekov.co/webhooks/creem` |

Eventos: checkout/pago completado. El worker distingue:

- `payment_kind=subscription` → activa org o **upgrade** de `plan_slug`
- `payment_kind=wallet` → acredita `org_wallets`

Success URL: `APP_URL/billing/success?ref=…`

---

## Auditoría rápida (15 min)

1. [ ] Precios Creem = tabla arriba (web + checkout).
2. [ ] Webhook test y prod apuntan a la API correcta; secret sincronizado.
3. [ ] Checkout test: Starter → org `active` + plan `starter`.
4. [ ] Checkout wallet test (con product IDs): saldo en **Facturación** y ledger en Ops.
5. [ ] Upgrade: org activa en Growth → checkout Business → `plan_slug` business en D1.
6. [ ] Ops `/metrics`: MRR y margen con uso real.

Tras cambiar `.env` o precios: `npm run desk:secrets:test` (o prod) + `npm run desk:deploy:test`.

---

## Enterprise (sin Creem self-serve)

1. Ops crea/ajusta org (`plan_slug`, `status=active`).
2. Wallet grant si hace falta (`POST /v1/ops/orgs/:id/wallet/grant`).
3. Contrato y factura fuera de Creem; legal en `/legal`.

---

## Código relacionado

| Área | Ruta |
|------|------|
| Precios públicos | `packages/domain/src/marketing.ts` |
| Límites técnicos | `packages/domain/src/plans.ts` |
| Wallet packs | `packages/domain/src/economics.ts` |
| Checkout subs/wallet | `packages/platform-api/src/routes/admin.ts` |
| Webhook | `packages/platform-api/src/routes/webhooks.ts` |
| Panel tenant | `/dashboard/billing` |
| Diseño wallet | `docs/WALLET_PAYGO.md` |
