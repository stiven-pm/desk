# Visitante: bucle agente y UX (referencia OpenClaw / Hermes)

Estudiado en `/tmp/agent-study` (clones temporales, no dependencia del repo):

| Fuente | Qué tomamos |
|--------|-------------|
| [OpenClaw `agent-loop`](https://github.com/openclaw/openclaw/blob/main/docs/concepts/agent-loop.md) | Turno serializado: lifecycle, `tool_execution_*`, assistant deltas, no bloquear al visitante en silencio |
| OpenClaw `AgentEvent` (`packages/agent-core`) | `thinking` → tools → prosa final |
| Hermes `run_agent.py` / state runtime | Stream de tool output, historial como fuente de verdad, tools antes de prosa |

## Implementación Desk

- **`visitor-agent-stream.ts`**: handlers `onStatus(thinking|tool|composing)`; sin stream simulado — el cliente muestra typing hasta el evento `done`.
- **`conversation-do`**: NDJSON `start` / `status` / `delta` / `done`; pasa handlers al agente.
- **`agent.ts`**: eventos por tool; `turnKind: service` si hubo integración HTTP/MCP/meta.
- **Contrato de turno**: con tools en sesión, texto al visitante solo vía `desk_visitor_message({ text })`; la escalera LLM no acepta prosa sola hasta degradado (paso 4). Sin pre-parseo del mensaje del visitante.
- **`visitor-actions-policy`**: `greeting` → menú; `faq` / `service` → sin menú automático; checkout/carrito sin cambiar.
- **`persona-prompt`**: bias de acción en el turno (no prometer revisión sin tool).

## Qué sigue siendo distinto (a propósito)

- Checkout y `__desk:*` firmados (dinero) — solo **tienda nativa Desk**.
- Meta-tools cuando hay muchas integraciones (`desk_search_integrations`); el modelo elige query y args, no regex sobre el mensaje del visitante.
- Workers AI (no CLI OpenClaw).

## Tres planos de backend (mañana +2 plantillas = solo config)

| Plano | Qué es | Cómo agrega el tenant | Código en deploy |
|-------|--------|------------------------|------------------|
| **Integraciones (plantillas)** | `integration_definitions` + `integration_operations` (`expose_to_ai`, params, path/body templates, `response_map`) | Instancia con credenciales; operaciones ERP/CRM/Excel/API pasan al agente como tools LLM | **Ninguno** — solo D1 + definición |
| **Pasarelas** | Todas igual: instancia `kind=payment` + capabilities `payment.create_link` / `payment.verify` (checkout y consulta vía plantilla; no hay pasarela “nativa” distinta) | Cambiar/agregar plantilla + instancia activa en org | **Ninguno** en runtime de cobro salvo nueva capability en el motor |
| **Tienda nativa Desk** | `commerce_*` + D1 `sales_orders` + checkout firmado | Org con comercio nativo | Cambios solo en contrato nativo (carrito/UI), no por cada ERP |

Flujo agente (OpenClaw / Hermes): **prompt delgado + bucle tool-call**. El modelo lee el hilo, infiere parámetros y llama `commerce_get_order` / integraciones; el runtime **no** pre-parsea texto del visitante ni rescata pedidos por regex.

- HTTP legacy (`bot_http_tools`) sigue si no hay instancias Desk; con instancias conectadas se prioriza `loadOrgIntegrationTools`.
- Meta-tools = catálogo grande (como tool search): `desk_search_integrations` → `desk_call_integration`.
- Skills (`bot_skills`) = procedimiento tenant; no sustituyen una operación expuesta.

## Medición

Ver tags en [AI.md](./AI.md): `desk_agent_llm_attempt`, `desk_tool_parsed_from_text`, `desk_llm_empty_response`.
