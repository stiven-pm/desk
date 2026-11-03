# Desk — comandos de deploy

## Los 4 que importan

| Comando | Qué hace |
|---------|----------|
| `npm run desk:secrets:test` | Sube **secretos** del `.env.test` al Worker test (JWT, Creem, etc.) — la IA usa Workers AI, no API key externa |
| `npm run desk:secrets:prod` | Igual con `.env.production` → Worker prod |
| `npm run desk:deploy:test` | **Todo test**: provision D1/KV si faltan, migraciones, API + panel + ops |
| `npm run desk:deploy:prod` | **Todo prod** (mismo prepare + deploy) |

No rellenes manualmente `D1_DATABASE_ID*` en `.env` si el prepare puede correr: crea/resuelve D1/KV.  
`desk:secrets:test` **no** crea D1/KV ni arregla auth de Wrangler; solo sube JWT/Creem al Worker.

**Token Cloudflare:** `CF_D1_ADMIN_TOKEN` / `CF_API_TOKEN` en `.env.*` — **D1 Edit** y **Workers KV Storage Edit** (provision/migraciones). `desk:secrets:*` usa **login de Wrangler** (OAuth), no `CF_D1_ADMIN_TOKEN`. Con `--env test`, Wrangler cargaba `.env.test` y volvía a usar `CF_API_TOKEN` aunque hicieras login; el script pasa `--env-file /dev/null` como en deploy. Si falla “No access”, `npx wrangler login`.

## Primera vez (test)

```bash
npm run desk:env:pull          # secretos/CF/Creem desde Flatbase → .env.*
npm run desk:secrets:test
npm run desk:deploy:test
npm run desk:smoke:test        # opcional
```

## Siguientes deploys test

```bash
npm run desk:deploy:test
```

## Producción

```bash
npm run desk:env:pull          # si cambió algo en Flatbase
npm run desk:secrets:prod      # cuando cambien secretos
npm run desk:deploy:prod
```

## Atajo “secrets + deploy”

```bash
npm run desk:ship:test
npm run desk:ship:prod
```

## Logs del agente (`DESK_TRACE`, `DESK_LLM_DEBUG`)

Van al **Worker** (`desk-api`), no a la consola del navegador del widget.

1. Pon `DESK_TRACE=1` (y opcional `DESK_LLM_DEBUG=1`) en `.env.production` — el render de wrangler los sube como `[vars]`.
2. Tras deploy, en otra terminal:

```bash
npm run desk:tail:prod
```

Filtra líneas JSON: `desk_trace`, `desk_llm_ladder`, `desk_agent_turn_rescue`, `desk_llm_attempt`. Cada turno del visitante pasa por el DO de conversación en ese worker.

## Paridad test ↔ prod

El **mismo artefacto** se despliega en ambos entornos. Validar en test antes de prod:

```bash
npm run desk:smoke:test    # health, openapi, widget CDN, desk, ops
npm run desk:deploy:prod   # cuando smoke test OK
npm run desk:smoke:prod
```

Diferencias intencionales (solo `.env` + wrangler render):

- URLs (`*.rekov.co` vs `*-test-*`)
- `CREEM_API_BASE_URL` y `CREEM_PRODUCT_*`
- `SIGNUPS_OPEN` (test suele `false`, prod `true` — override en `.env.production` / `.env.test`)

OAuth: mismas claves en **ambos** `.env` (IDs públicos) y `desk:secrets:*` para `*_CLIENT_SECRET`. Ver redirect URIs en [PRODUCT.md](./PRODUCT.md).

## Smoke

| Comando | Env file |
|---------|----------|
| `npm run desk:smoke:test` | `.env.test` |
| `npm run desk:smoke:prod` | `.env.production` |

Comprueba: `/health`, `/openapi.json`, `/cdn/desk-widget.js`, desk y ops responden.

## Creem (3 productos)

En `.env` van `CREEM_PRODUCT_STARTER`, `CREEM_PRODUCT_GROWTH`, `CREEM_PRODUCT_BUSINESS`: son los **mismos 3 tiers** que Flatbase (Hobby → Starter, Startup → Growth, Pro → Business). El **precio en USD** lo defines en Creem; el código solo enlaza product_id ↔ plan.

Ver [PRODUCT.md](./PRODUCT.md) para qué incluye cada plan.
