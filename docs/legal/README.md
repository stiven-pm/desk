# Legal — Desk / Rekov Systems S.A.S.

Public URLs (after deploy to production):

| Document | URL (Meta / international) | URL (ES) |
|----------|------------------------------|----------|
| Privacy Policy | https://desk.rekov.co/privacy | https://desk.rekov.co/privacidad |
| Terms of Service | https://desk.rekov.co/terms | https://desk.rekov.co/terminos |
| Legal hub | — | https://desk.rekov.co/legal |
| Cookies | https://desk.rekov.co/legal/cookies | — |
| DMCA | https://desk.rekov.co/legal/dmca | — |

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
- **Product:** Desk
- **Contact:** contact@rekov.co · privacy@rekov.co · security@rekov.co
- Tax ID (NIT) is **not** required in privacy/terms for Meta; add to invoices and RUES-facing forms separately.

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
