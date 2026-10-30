# Desk on Cloudflare

## Hostnames (one label under `rekov.co`)

| | Production | Test |
|--|------------|------|
| Desk (cliente) | `https://desk.rekov.co` | `https://test-desk.rekov.co` |
| Ops (Rekov) | `https://ops-desk.rekov.co` | `https://ops-test-desk.rekov.co` |
| API | `https://api-desk.rekov.co` | `https://api-test-desk.rekov.co` |
| D1 | `desk-control` | `desk-control-test` |
| Creem webhook | `…/webhooks/creem` | `…/webhooks/creem` |

## IA (Rekov opera el proveedor)

Ver **[AI.md](./AI.md)** (Workers AI, DO + Vectorize, WebSocket, timeouts). Resumen: binding `[ai]` en el Worker; modelos en vars (`WORKERS_AI_*`); sin API keys externas; clientes no ven credenciales de IA.

## Vectorize

Dimensiones del índice = las del modelo de embeddings (`EMBEDDING_DIMENSIONS`, por defecto **1024** con BGE-M3). Si migras de OpenAI (1536), crea un índice nuevo y re-ingesta documentos.

## Email

- `[[send_email]]` (binding `EMAIL`) + `DESK_FROM_EMAIL` con dominio verificado en Cloudflare Email Sending.

Sin email configurado, las invitaciones siguen mostrando el link en Ops/UI.

## Deploy (como Flatbase: un comando)

`prepare-deploy` corre **antes** de cada deploy (provision D1/KV si faltan, IDs en `.env`, `wrangler.toml` generado, migraciones D1). No hace falta una “fase manual” aparte.

**Primera vez** (secretos desde Flatbase):

```bash
npm run env:sync-flatbase
npm run cf:secrets:sync:test
npm run cf:test:deploy
```

**Siguientes veces:**

```bash
npm run cf:test:deploy
```

Flatbase guarda los UUID de D1/KV en su `wrangler.toml` (`flatbase-control-test`). Desk usa recursos distintos (`desk-control-test`, etc.); el deploy los crea en la cuenta si no existen.

Scripts opcionales (debug): `wrangler:render`, `cf:bindings:resolve`, `cf:provision:test`, `d1:migrate:test`.

## Ops login

1. En `.env.test` / `.env.production`: `OPS_BOOTSTRAP_ADMIN_EMAILS` (emails permitidos) y `OPS_BOOTSTRAP_PASSWORD`.
2. `npm run desk:secrets:test` (o `prod`) sube `OPS_BOOTSTRAP_PASSWORD` al Worker.
3. Entra en **`https://ops-test-desk.rekov.co`** (incluye `-desk`; `ops-test.rekov.co` sin `-desk` no es Desk).
   Alternativa si el dominio custom falla: `https://desk-ops-dashboard-test.<tu-subdominio>.workers.dev` (sale en el deploy de `desk-ops-dashboard-test`).
4. Comprueba desde tu máquina: `npm run desk:smoke:test` (debe terminar en `smoke ok`).
5. Si el navegador muestra **HTTP 403 Access denied** (página genérica de Chrome, sin formulario “Desk · ops”):
   - Prueba ventana de incógnito o otro navegador.
   - Revisa **Zero Trust → Access** por una app que cubra `ops-test-desk.rekov.co` o `*.rekov.co`.
   - El panel ops no usa Access por defecto; solo login email/contraseña del Worker.
6. Crear org → invitación al owner → aceptar en el link.
