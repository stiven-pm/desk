# Ops: salud, errores y economía

Todo visible en **Ops → Salud** y en cada **Empresa** (bloque salud 7 d). No hace falta `wrangler tail` ni SQL manual para el día a día.

## Desplegar

1. Aplicar migración D1: `infra/cloudflare/d1/0050_ops_telemetry.sql` (test + prod).
2. Deploy API + ops-dashboard (`desk:deploy:*`).

Hasta migrar D1, las pantallas pueden fallar al cargar eventos (tablas inexistentes).

## Qué se guarda (D1)

| Tabla | Contenido |
|-------|-----------|
| `ops_signal_events` | Errores/aviso: LLM, agente degradado, tools HTTP/codemode, API 4xx/5xx, topes de uso |
| `ops_visitor_turns` | Por turno visitante: duración ms, créditos medidos, degradado, código error |

Retención: cron 03:00 UTC purga señales &gt; 45 d, turnos &gt; 90 d.

## Pantallas Ops

| Ruta | Uso |
|------|-----|
| **Salud** | Errores 24 h / 7 d, lista filtrable, p50/p95 créditos/msg y latencia, margen vs coste est. |
| **Métricas** | MRR y cupos agregados (enlace a Salud) |
| **Empresa → detalle** | p95 org, últimas señales, integraciones |

## Cuando un cliente reporta un error

1. Ops → **Salud** (o empresa) → filtrar por slug / ventana.
2. Leer fila: `categoría/código`, resumen, `request_id` si API.
3. `conversation_id` en detalle JSON si aplica (sin leer el chat).

## Bandas de coste

Siguen en `@chatbot/domain` (`ECONOMICS_USD_PER_1K_CREDITS`). Ops calcula variable + fijo + Creem sobre **créditos medidos reales** del mes, no números hardcodeados en UI.

## Cloudflare (factura real MTD)

Ops → **Salud** → bloque **Cloudflare (factura MTD)**.

1. Crea un API token con **Account → Billing → Read**.
2. En `.env.production`: `CF_BILLING_API_TOKEN=...` ( `CF_ACCOUNT_ID` ya debe existir).
3. `npm run desk:secrets:prod` y redeploy API.
4. Pulsa **Sincronizar ahora** o espera el cron 03:00 UTC.

Usa la [Billable Usage API](https://developers.cloudflare.com/api/resources/billing/subresources/usage/) (v1 `billable-usage`, fallback v2 `billable/usage`). Los importes son los de Cloudflare (`ContractedCost`), actualizados ~diario.

**Cuadre:** compara **CF facturado** con **Desk infra est.** (variable IA por créditos medidos + fijo planificado por org). Creem va aparte (no es CF). Δ infra positivo = CF cobró más de lo que el modelo Desk preveía para infra.

Cache en D1: `ops_cf_billing_cache`.

## SEO

Ops **no** incluye SEO web; solo salud del producto Desk.
