# Comercio nativo Colombia (plantilla Desk)

Plantilla instalable desde **Capacidades → Procedimientos** o vía API
`POST /v1/admin/bots/:botId/skills/install-template` con `{ "template": "commerce-co-native" }`.

El texto canónico vive en `packages/platform-api/src/lib/setup-skill-template-commerce-co.ts`.
Tras instalar, revisa el borrador, ajusta con el setup-agent y **publica** el skill.

Ver también `docs/SETUP_AGENT.md` y `docs/adr/commerce-sources-of-truth.md`.
