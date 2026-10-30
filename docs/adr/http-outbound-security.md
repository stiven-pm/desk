# ADR: HTTP saliente del asistente (SSRF y secretos)

## Estado

Aceptado (oleada 3).

## Decisión

- Toda URL de `executeHttpTool` pasa por `assertPublicHttpUrl` y debe coincidir el host con `base_url` de la herramienta.
- Respuestas redactan tokens antes de volver al modelo.
- Máximo 12 llamadas HTTP por turno del agente.
- Conexión rápida: `POST /v1/admin/bots/:id/http-tools/import-curl` parsea cURL, cifra secretos, crea `bot_http_tools`.
- Setup-agent reutiliza las mismas reglas SSRF vía `@chatbot/domain/outbound-url`.

## Consecuencias

- No se puede apuntar herramientas a localhost o metadata cloud.
- El modelo nunca recibe el cURL completo tras importar; solo nombres de herramientas.
