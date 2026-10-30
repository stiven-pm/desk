# Wallet de créditos + Creem one-time (diseño mínimo)

Estado: **operativo en código (2026)** — consumo plan → wallet, `POST /v1/admin/billing/wallet/checkout`, webhook/poll, UI `/dashboard/billing`. Falta crear productos one-time en Creem y pegar `CREEM_PRODUCT_CREDITS_*` en `.env`.

Referencias: `docs/COST_PER_MESSAGE.md`, `docs/UNIT_ECONOMICS.md`, `docs/CREEM.md`.

## Objetivos

1. Cuando se agoten **mensajes o créditos del plan**, permitir seguir operando con saldo prepago.
2. Dos modos comerciales claros:
   - **Con plan activo:** recarga barata (fidelización).
   - **Sin plan activo (solo wallet):** recarga cara o bloqueado (evitar free-rider).

## Modelo de datos (D1)

```sql
-- Migración futura
CREATE TABLE org_wallets (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id),
  balance_credits INTEGER NOT NULL DEFAULT 0,
  lifetime_purchased_credits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wallet_ledger (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  delta_credits INTEGER NOT NULL,
  kind TEXT NOT NULL, -- 'creem_purchase' | 'consumption' | 'ops_grant' | 'refund'
  creem_checkout_id TEXT,
  usd_cents INTEGER,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Opcional: `orgs.wallet_mode TEXT` — `disabled` | `addon_only` | `standalone` (solo Rekov ops).

## Orden de consumo (runtime)

En `assertWithinUsage` / `assertOrgUsage`:

1. Cupo **mensajes** del plan (`monthlyMessages`).
2. Si mensajes OK, cupo **créditos IA del plan** (`monthlyAiCredits`).
3. Si créditos del plan agotados pero mensajes OK → descontar **`org_wallets.balance_credits`**.
4. Si ambos agotados → **429** con código `usage_credits_exceeded` o `usage_messages_exceeded`.

Mensajes: o solo plan, o permitir “mensaje = 1 crédito de wallet” (más simple: **solo créditos en wallet**, mensajes siguen siendo techo del plan).

Recomendación v1: **wallet solo para créditos IA**; mensajes requieren **upgrade de plan** (menos edge cases).

## Precio Creem (one-time)

Productos Creem sugeridos (USD, cliente elige cantidad en checkout si Creem lo permite; si no, packs fijos):

| SKU | USD | Créditos Desk | $/1k créditos cliente | Notas |
|-----|-----|---------------|------------------------|-------|
| `desk-credits-25` | $25 | 25 000 | $1.00 | Mínimo útil (Creem fees) |
| `desk-credits-50` | $50 | 55 000 | ~$0.91 | +10% bonus |
| `desk-credits-100` | $100 | 120 000 | ~$0.83 | +20% bonus |

**Con plan activo:** mismos packs o **+15% créditos** bonus.

**Sin plan activo (`standalone`):**

- Opción A (recomendada): **no chat público** — solo panel lectura + comprar plan.
- Opción B: permitir chat si `balance_credits > 0` con precio **+30%** (menos créditos por dólar que con plan).

### Margen (con coste real “típico” ~$0.023/msg ≈ 8–20 créditos según cómo cuentes Vectorize)

| Retail | Coste IA+Vectorize típico (8–15 créditos/msg) | Margen bruto variable |
|--------|-----------------------------------------------|------------------------|
| $1.00 / 1k créditos | ~$0.18 – 0.35 / 1k créditos consumidos | **~65–82%** si índice pequeño |
| $1.00 / 1k | Índice 10k vectores (~$0.10/msg) | **puede ir al 0%** → sube precio o particiona Vectorize |

Ajusta packs tras medir en test (`docs/COST_PER_MESSAGE.md`).

## API (mínimo)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/admin/billing/wallet` | `{ balanceCredits, planUsage, limits }` |
| POST | `/v1/admin/billing/wallet/checkout` | `{ pack: '25' \| '50' \| '100' }` → URL Creem one-time |
| POST | `/webhooks/creem` | Ampliar: si `product` es wallet → `creditWallet(org, credits, usd)` |

Webhook idempotente por `checkout_id` / `request_id` (igual que suscripción).

## Reglas de negocio

| Condición | Chat público | Panel | Recarga |
|-----------|--------------|-------|---------|
| `status=active` + cupo plan | Sí | Sí | Opcional addon |
| `status=active` + plan sin créditos + wallet > 0 | Sí (consume wallet) | Sí | Sí |
| `status=active` + sin cupo ni wallet | 429 | Sí (upgrade) | Sí |
| `status≠active` + wallet > 0 (modo B) | Solo si política `standalone` | Limitado | Sí (premium) |
| `status≠active` + wallet = 0 | `org_inactive` | 402 | Checkout plan |

**Owner** con capacidad `billing` puede comprar packs; igual que suscripción.

## UI (dashboard)

1. Resumen: barra plan + “Saldo prepago: X créditos”.
2. Botón “Recargar créditos” → packs Creem.
3. Copy: “Los créditos se usan cuando se agota el cupo de IA del plan; no sustituyen el plan mensual.”

## Implementación por fases

1. **Fase A:** tabla wallet + ledger + webhook Creem one-time + consumo después del plan.
2. **Fase B:** packs en pricing + FAQ.
3. **Fase C:** metering honesto (embed + factor Vectorize en créditos Desk).
4. **Fase D:** modo `standalone` o bloqueo estricto sin plan.

## Checklist Creem

- [ ] Productos one-time en dashboard Creem (test + prod) — ver `docs/PRICING_AND_CREEM_AUDIT.md`.
- [ ] Vars `CREEM_PRODUCT_CREDITS_25/50/100` en `.env` + `desk:deploy` (wrangler vars).
- [x] Webhook + poll distinguen `payment_kind=wallet` vs suscripción.
- [x] UI tenant Facturación + upgrade plan.
- [ ] E2E manual: compra pack → chat tras agotar cupo plan usa wallet.
