# Legal — Desk / Rekov Systems S.A.S.

Public URLs (after deploy to production):

| Document | URL (Meta / international) | URL (ES) |
|----------|------------------------------|----------|
| Privacy Policy | https://desk.rekov.co/privacy | https://desk.rekov.co/privacidad |
| Terms of Service | https://desk.rekov.co/terms | https://desk.rekov.co/terminos |
| Legal hub | — | https://desk.rekov.co/legal |
| Cookies | https://desk.rekov.co/legal/cookies | — |
| DMCA | https://desk.rekov.co/legal/dmca | — |
| Disponibilidad (sin SLA self-serve) | — | https://desk.rekov.co/legal/disponibilidad |
| DPA (B2B, web) | — | https://desk.rekov.co/legal/dpa |
| FAQ compradores (pagos, créditos, IA) | — | https://desk.rekov.co/preguntas |

## Meta Developers — mandatory app settings

| Campo en Meta | URL en producción |
|---------------|-------------------|
| **Privacy Policy** / Política de privacidad | `https://desk.rekov.co/privacy` (EN, recomendado para revisión) · `https://desk.rekov.co/privacidad` (ES) |
| **Terms of Service** / Condiciones del servicio (app + diálogo de login) | `https://desk.rekov.co/terms` (EN) · `https://desk.rekov.co/terminos` (ES) |
| **User data deletion** / Eliminación de datos | `https://desk.rekov.co/privacy#rights` (instrucciones EN) · `https://desk.rekov.co/privacidad#derechos` (ES). Contacto: `privacy@rekov.co` |

1. Todas las URLs deben responder **200** en HTTPS antes de guardar en Meta.
2. **App icon:** 512×512–1024×1024 PNG/JPG, max 5 MB.
3. **Category:** Business or Productivity.
4. **App Review videos:** send message via API + create template via management API (per Meta checklist).

Nota: registro e inicio de sesión en Desk (`/register`, `/login`) exigen **aceptación explícita** de términos, privacidad y aviso de IA antes de autenticarse. Meta sigue requiendo además la **URL pública** del documento.

## Versión legal (aceptación en producto)

- Constante: `LEGAL_TERMS_VERSION` en `packages/domain/src/legal-meta.ts` (p. ej. `2026-11-03`).
- Migración D1: `infra/cloudflare/d1/0052_user_terms_acceptance.sql` (`terms_accepted_version`, `terms_accepted_at` en `users`).
- Aplicar migración en test/prod **antes** de desplegar API que persiste aceptación en login/registro.

## Geo / subencargados

- **No** usamos ip.guide, ipquery.io ni otros proveedores externos de geolocalización por IP.
- Ubicación aproximada (país/ciudad) solo puede derivarse de cabeceras Cloudflare en el borde para contexto de chat y seguridad (`visitor-geo.ts`).
- Subencargados principales en política: Cloudflare, Creem, integraciones del cliente.

## Entity (public copy)

- **Legal name:** Rekov Systems S.A.S. (Colombia)
- **NIT:** `902122807-2` — `LEGAL_ENTITY.taxId` en `entity.ts`; hub legal y cabecera de políticas
- **Product:** Desk
- **Contact:** contact@rekov.co · privacy@rekov.co · security@rekov.co
- Representante legal y domicilio **no** van al sitio (solo email de contacto).

## Creem (factura al cliente — no es código Desk)

**Creem** es quien cobra la tarjeta y emite el recibo/comprobante que ve el comprador. Desk solo abre el checkout (`POST /v1/admin/billing/checkout`) y activa la org cuando Creem confirma el pago.

En el **panel de Creem** (tienda `desk`, modo test y live), configura los datos del comercio para que el recibo muestre la misma identidad que el sitio:

| Campo en Creem | Valor |
|----------------|--------|
| Razón social / legal name | Rekov Systems S.A.S. |
| NIT / tax ID | 902122807-2 |
| País | Colombia |
| URL del sitio | https://desk.rekov.co |

Desk **no** puede inyectar el NIT en el PDF de Creem desde el Worker; si el recibo sale mal, se corrige en Creem, no en `packages/`.

Ver también `docs/CREEM.md` y `docs/CREEM_AND_PRICING.md`.

## Legal go-live (prod)

1. Commitear y desplegar dashboard + API (`npm run desk:deploy:prod` aplica migraciones D1 remotas, incl. `0052_user_terms_acceptance.sql`).
2. Smoke: `/legal`, `/legal/dpa`, `/legal/disponibilidad`, `/terminos`, `/privacidad` → 200.
3. Creem live: razón social + NIT en merchant; precios 99 / 199 / 589 en productos.
4. Buzones `privacy@` y `security@` (alias OK).
5. **Email onboarding:** tras primer pago de plan, `sendOnboardingWelcomeEmail` (Cloudflare Email Sending + `DESK_FROM_EMAIL`). Copia interna a `DESK_ONBOARDING_NOTIFY_EMAIL` (default `contact@rekov.co`). Idempotente vía `audit_log.onboarding_welcome_sent`.
6. **Créditos compensación:** Ops `POST /v1/ops/orgs/:orgId/wallet/grant` con `kind: "service_credit"` y `note` (impacto); política pública en `/legal/disponibilidad`.

## Source of truth in code

- `packages/dashboard/src/content/legal/*` — policy text
- `packages/dashboard/src/app/privacy`, `/terms`, `/privacidad`, `/terminos`, `/legal/*` — routes

## Templates reference

Structure informed by [General Legal legal-templates](https://github.com/General-Legal/legal-templates) (CC0). Have a Colombian counsel review before relying in disputes or regulated sectors.

## Checklist before go-live

- [ ] Deploy dashboard so `/privacy` returns 200 on production
- [ ] Crear buzones `privacy@` y `security@` (o alias a contact@)
- [ ] Registrar agente DMCA si esperas tráfico US con UGC
- [ ] Customer-facing WhatsApp opt-in copy in tenant onboarding
- [ ] Enterprise DPA on request (optional template: legal-templates `dpa-global`)
