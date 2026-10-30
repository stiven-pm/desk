# ADR: integraciones declarativas y capacidades estándar

## Contexto

Desk no expone un constructor de APIs al cliente. Las integraciones viven en código (`builtin-integrations`); Ops las asigna por org; el tenant completa credenciales cifradas en Integraciones.

## Decisión

1. **Plantilla = datos**: conector (base URL, auth, allowlist), operaciones HTTP (parámetros por origen, request, mapeo de respuesta), perfil de pago/webhook cuando aplica.
2. **Capacidades estándar (v2)** — el router Desk y `commerce_*` usan estos nombres:
   - `catalog.search`, `catalog.get`, `stock.check` (stub opcional)
   - `order.create`, `order.status`
   - `payment.create_link`, `payment.verify`
   - `custom` para herramientas HTTP solo-IA sin slot de producto
3. **Operaciones ilimitadas** por plantilla; cada una puede exponer herramienta LLM (`exposeToAi`, `tool_name`, params `ai` → `input_schema`).
4. **Orígenes de parámetro**: `ai`, `config`, `secret`, `ctx`, `fixed`, `computed` (`cart_total`, `order.reference`).
5. **Versionado**: `integration_definitions.version` + `pinned_version` por instancia; cambios con clientes activos incrementan versión.
6. **Legacy**: `bot_http_tools` no se carga si la org tiene instancias Desk habilitadas. Nombres de capacidad v1 se migran en D1 `0027`.

## Consecuencias

- Nuevas pasarelas/catálogos se agregan en código y se sincronizan a D1 al arrancar la API (salvo extensiones del motor: HMAC firmado, OAuth).
- Secretos nunca entran al prompt; el motor HTTP aplica allowlist de host y valida args `ai` con reglas del schema.
- OAuth/HMAC avanzado sigue fuera de alcance v2.
