# Desk — qué es y estado del producto

## Qué es este repositorio

Plataforma **Desk** de **Rekov Systems**: SaaS multi-tenant de **atención al cliente por chat con IA**. No es contact center omnicanal ni BaaS.

| Capa | Qué hace |
|------|----------|
| **Marketing** | `desk.rekov.co` — landing, `/plataforma`, precios, legal |
| **App tenant** | Registro, panel, bots, documentos, integraciones, billing |
| **Chat alojado** | `/chat/{orgSlug}` — usuario final |
| **Runtime** | Workers + Durable Objects — conversaciones, RAG, tools HTTP/OpenAPI/MCP |
| **Ops** | `ops-desk.rekov.co` — operación interna Rekov |

**Mensaje:** asistente con **tus documentos y datos conectados**, **cupos y precio mensual claros**, **handoff a humanos** con contexto.

**Desk ≠ Flatbase:** Flatbase es BaaS (SQLite edge, auth, storage). Desk es **soporte conversacional**; puede consumir APIs, no vende “capa de datos unificada”.

**Competencia aproximada:** chat + conocimiento + escalado (Tidio, Intercom Fin, Crisp…), no suites de voz/WhatsApp masivo.

Identidad visual: [BRANDING.md](./BRANDING.md). Posicionamiento extendido: [POSITIONING.md](./POSITIONING.md).

## Superficies

| Superficie | URL | Quién |
|------------|-----|--------|
| Marketing | `desk.rekov.co` | Público |
| App | `/dashboard` | Admin tenant |
| Chat | `/chat/{orgSlug}` | Usuario final |
| Ops | `ops-desk.rekov.co` | Rekov |

## Planes

**Starter**, **Growth**, **Business** — `packages/domain/src/plans.ts`. Precios USD en `packages/domain/src/marketing.ts`.

| Plan | Créditos IA / mes | Mensajes / mes | Bots | Docs RAG | Orígenes / bot | Retención |
|------|-------------------|----------------|------|----------|----------------|-----------|
| **Starter** | 50 000 | 2 000 | 1 | 5 | 3 | 14 días |
| **Growth** | 200 000 | 10 000 | 5 | 25 | 10 | 30 días |
| **Business** | 1 000 000 | 50 000 | 25 | 100 | 50 | 90 días |

- **Starter:** documentos + chat (sin OpenAPI, MCP, conectores ni webhooks salientes).
- **Growth+:** integraciones en vivo en panel **Integraciones** (estándar SaaS: Intercom/Zendesk usan “Integrations”).

Purga: cron `0 3 * * *` — D1 + estado DO (`/purge`) según `logRetentionDays`.

## Paridad test ↔ producción

Mismo código y mismos scripts; solo cambian URLs, productos Creem y flags en `.env`:

| Aspecto | Test | Producción |
|---------|------|------------|
| Deploy | `npm run desk:deploy:test` | `npm run desk:deploy:prod` |
| Secretos | `desk:secrets:test` | `desk:secrets:prod` |
| Smoke | `npm run desk:smoke:test` | `npm run desk:smoke:prod` |
| Registro | `SIGNUPS_OPEN=false` (default render) | `SIGNUPS_OPEN=true` (default render) |
| Creem API | `test-api.creem.io` | `api.creem.io` |

Si `desk:smoke:test` pasa, el binario desplegado en prod es el mismo; falta solo `desk:deploy:prod` (+ secretos OAuth/Creem en cada entorno).

OAuth Google (mismo app o dos clientes): redirect URI

- Test: `https://api-test-desk.rekov.co/v1/admin/oauth/google/callback`
- Prod: `https://api-desk.rekov.co/v1/admin/oauth/google/callback`

Vars en `.env.*`: `GOOGLE_OAUTH_CLIENT_ID`, …; secretos vía `desk:secrets:*` (`*_CLIENT_SECRET`).

## Capacidades (resumen)

| Capacidad | Estado |
|-----------|--------|
| Chat público + RAG + Workers AI | ✓ |
| Inbox / handoff humano | ✓ |
| Billing Creem | ✓ |
| Integraciones Growth+ (OpenAPI, HTTP, MCP, conectores, webhooks) | ✓ |
| Widget CDN `/cdn/desk-widget.js` | ✓ |
| Analytics tenant (`/dashboard/analytics`) | ✓ |
| Purga logs + DO | ✓ |

## Panel vs chat público

| Quién | Cómo entra | Para qué |
|-------|------------|----------|
| **Cliente / usuario final** | Enlace `/chat/{orgSlug}` o widget en la web de la empresa | Preguntar, pedir soporte, sin cuenta Desk |
| **Equipo de la empresa** | Login en Desk (`/login`) | Conocimiento, fuentes, bandeja, métricas, invitar colegas |

Roles del panel (`owner`, `admin`, `developer`, `agent`, `viewer`) controlan **el backoffice**, no el chat público.

## Gaps conocidos (no bloquean MVP)

1. Chat por `botId` en URL (hoy: org slug, primer bot).
2. Widget sin paridad WebSocket completa del chat alojado.
3. Calidad de tool-calling acotada por Workers AI + fallback JSON.
4. HubSpot/Shopify: OAuth + un paso de config (tienda, etc.).
5. Wallet créditos + Creem one-time — diseño en `docs/WALLET_PAYGO.md`; coste por mensaje en `docs/COST_PER_MESSAGE.md`.

## Comandos

[DEPLOY.md](./DEPLOY.md)
