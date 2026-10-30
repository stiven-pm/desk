# Agente Setup vs chat público

Desk implementa el patrón de agentes “omnipotentes” de código (OpenClaw / Claude Code) **sin bash ni contenedor por tenant**: autoconfiguración vía **meta-herramientas** en infra Workers + D1.

## Dos agentes

| | **Setup** (admin) | **Visitor** (público) |
|--|-------------------|------------------------|
| Ruta UI | `/dashboard/capabilities` | `/chat/{slug}`, widget |
| API | `POST /v1/admin/bots/:id/setup-agent/chat` | WebSocket / chat público |
| Auth | JWT panel (`owner`, `admin`, `developer`) | Clave publicable / origen |
| Turnos tool | ~14 meta-tools / mensaje | ~8 rondas HTTP/MCP |
| Skills | Crea/edita borrador y publica | Solo `published` |
| Secretos | Cifrados al guardar (`ENCRYPTION_KEY`) | Nunca en prompt |

## Meta-herramientas (Setup)

- `desk_workspace_status` — estado del bot
- `desk_set_instructions` — system prompt
- `desk_add_http_tool` — REST con auth cifrada
- `desk_register_mcp_server` — MCP dinámico
- `desk_upsert_connector` — Shopify, HubSpot, Sheets, etc.
- `desk_probe_http` / `desk_fetch_docs` — diagnóstico y docs (SSRF acotado)
- `desk_skill_read` / `desk_skill_save` / `desk_skill_publish` / `desk_skill_archive` — procedimientos (el prompt solo lleva resumen; lee el markdown completo antes de editar)
- `desk_register_mcp_server` — sincroniza catálogo MCP en D1 (`bot_mcp_tool_catalog`, migración `0012_harness.sql`); refresco manual en Capacidades → Conexiones

Skills viven en `bot_skills` (migración `0010_bot_agent_skills.sql`).

Tras mutar conexiones o skills, el arnés puede exigir `desk_workspace_status` o `desk_probe_http` antes de dar por cerrada la tarea (`HARNESS_SETUP_VERIFY`).

## Plantilla comercio Colombia

- `GET /v1/admin/setup-skill-templates/commerce-co-native` — markdown de referencia.
- `POST /v1/admin/bots/:botId/skills/install-template` — cuerpo `{ "template": "commerce-co-native" }` (borrador en `bot_skills`).
- Documentación: `docs/skills/commerce-co-native.md`.

## Qué no está (a propósito)

- Sin `exec`, npm, filesystem del host (no es OpenClaw en container).
- Sin `web_search` abierto en visitor (fetch de docs solo en Setup y allowlist).
- Plan **Starter**: Setup puede instrucciones + skills; integraciones en vivo requieren **Growth+**.

## Migración D1

```bash
# Aplicar en test/prod según vuestro flujo desk
wrangler d1 execute ... --file=infra/cloudflare/d1/0010_bot_agent_skills.sql
```

## Credenciales (modal)

- Tool `desk_request_credentials` → fila en `bot_setup_credential_requests`.
- El panel abre `SetupCredentialModal`; `POST .../setup-credentials/:id/fulfill` cifra y aplica (conector, OpenAPI auth, HTTP tool).
- `GET .../setup-credentials/pending` para recuperar formularios abiertos.

## OpenAPI desde URL

- `desk_import_openapi_url` — descarga spec (SSRF acotado) y `syncOpenApiTools`.

## Enterprise shell (Business)

- `enterpriseShell: true` en plan Business (`plans.ts`).
- `desk_enterprise_shell_queue` → `org_enterprise_shell_jobs`.
- Opcional: `ENTERPRISE_SHELL_BASE_URL` en el Worker para enlace a consola Moltworker/Computer.
- Un worker consumidor puede marcar jobs `running` / `done` (fase siguiente).

## Migraciones

- `0010_bot_agent_skills.sql`
- `0011_setup_credentials_shell.sql`
