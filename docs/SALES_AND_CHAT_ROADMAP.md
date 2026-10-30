# Roadmap: vender, atender y automatizar en el chat

## Objetivo

Un solo asistente que **vende** (catálogo, recomendación, siguiente paso), **atiende** (pedido, factura, ticket) y **automatiza** (acciones vía API), con UI que se ve como la web del cliente — sin ejecutar JS arbitrario del modelo.

## Ya en el repo (base)

| Pieza | Estado |
|-------|--------|
| Instrucciones tenant + capa persona | ✅ |
| RAG + caché 2 min por conversación (misma pregunta) | ✅ |
| Herramientas BYOK + agente multi-tool | ✅ |
| Ranking + arnés lazy tools (≤8 schemas, MCP catalog D1, router KV) | ✅ `0012_harness.sql`, `agent.ts` |
| Setup: verificación post-mutación + skills resumidos | ✅ `run-setup-agent.ts` |
| `desk-ui`: productos, choices, gen, html sanitizado, host | ✅ |
| `DeskHost` + postMessage (widget en iframe) | ✅ `desk-host.js` + `docs/DESK_HOST.md` |
| Widget iframe → chat hosted (UI rica) | ✅ |
| `themeCssUrl` + allowlist componentes | ✅ panel Asistente + migración `0008` |

## “Código de la web tal cual” — modelo correcto

No se puede correr el bundle del cliente dentro del chat (seguridad). El patrón es:

1. **Host registry** — La tienda registra `ProductCard`, `AddToCart`, etc. (`DeskHost.register`).
2. **Modelo emite** `{"type":"host","component":"ProductCard","props":{...}}` con props JSON validadas.
3. **Iframe del chat** hace `postMessage` al parent; el parent monta el **mismo componente React/Vue** que la tienda.

Para chat en **mismo dominio** (sin iframe): importar `@chatbot/chat-ui` + mismos componentes en la app Next del cliente.

HTML `desk-ui` + clases Tailwind del sitio funcionan si el chat va en **iframe** que carga el CSS del parent (pendiente: `themeUrl` / `link` al stylesheet del tenant).

## Optimizaciones (técnicas)

| Técnica | Desk hoy | Siguiente paso |
|---------|----------|----------------|
| RAG top-K + techo de chars | ✅ | Re-ranker pequeño (cross-encoder o LLM 1 frase) |
| Caché RAG por turno | ✅ 2 min DO | Caché KV por bot+hash pregunta |
| Tool routing / pruning | ✅ keyword rank | Router LLM barato (intención: venta/soporte/ERP) |
| Prompt caching (proveedor) | Workers AI | Agrupar system estático |
| Streaming con tools | ❌ | Stream solo último turno post-tools |
| Speculative RAG | ❌ | Embed en paralelo con primer token |
| KAG / grafo | ❌ | Solo si catálogo relacional complejo |
| Memoria conversación | DO SQL mensajes | Resumen rolling cada N turnos |
| Generative UI validada | JSON Schema por bloque | Validar en API antes de guardar mensaje |

## Implementar para “nivel Shopify”

### P0 — Experiencia venta/soporte

- [ ] Widget con mismo renderer que `ChatRichMessage` + WebSocket stream
- [ ] Iframe embed que inyecta `theme.css` del tenant (URL en config del bot)
- [ ] Panel: catálogo de componentes host permitidos (`ui_host_allowlist_json`)
- [ ] Acciones: `add_to_cart`, `open_checkout` como host actions + webhooks

### P1 — Automatización

- [x] Validación `desk-ui` (Zod) en runtime antes de guardar respuesta
- [x] Stream del último turno tras usar herramientas
- [x] Bloques `offers` + webhook `commerce.intent` + `DeskHost` actions
- [x] `postMessage` con origen allowlist (dominios del bot)
- [ ] Más herramientas por conector (crear cotización, actualizar ticket)
- [ ] Flujos (handoff → CRM note, tag Zendesk)

### P2 — Escala y coste

- [ ] Router de intención antes del modelo grande
- [ ] Memoria resumida + RAG híbrido (BM25 + vector)
- [ ] Analytics: qué tools/UI convierten

## Qué debe configurar cada empresa

1. Instrucciones (persona, venta vs soporte, escalamiento).
2. Documentos + integraciones (datos vivos).
3. (Opcional) `DeskHost.register` en su web + lista de `component` IDs en el prompt del bot.
4. OpenAPI para PLM/ERP raro.
