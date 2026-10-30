# Cómo se mide el uso (fuente de verdad)

## Dos cupos independientes

| Cupo en plan | Contador en D1 | Cuándo sube |
|--------------|----------------|-------------|
| `monthlyMessages` | `usage_counters.messages_count` | **+1 por cada mensaje del visitante** (cada turno que escribe el cliente) |
| `monthlyAiCredits` | `ai_credits_used` + `setup_credits_used` + `rag_meter_credits` | Chat (tokens), setup agent, **+3 créditos RAG por mensaje visitante** |

Si se agota uno, el chat devuelve **429** (`usage_messages_exceeded` o `usage_credits_exceeded`). Luego puede consumir **wallet** solo para créditos, no para mensajes.

## No es lo mismo “conversación” y “mensaje”

- **Conversación / sesión** = un `conversation_id` (el cliente abre el chat y puede hablar varias veces).
- **Mensaje (lo que facturamos hoy)** = cada envío del visitante.

**Persistencia visitante:** `visitorId` + `conversationId` en `localStorage`; al volver o recargar, `POST /v1/public/sessions` reanuda si hubo actividad en las últimas **24 h** (máx. **7 días** de antigüedad). Tras **72 h** sin mensajes, cron cierra chats `automated` (`phase=closed`). Constantes en `packages/domain/src/visitor-session.ts`.

**Fecha/hora en respuestas:** geo Cloudflare + ip.guide / ipquery.io → bloque “Contexto de sesión” en el system prompt (`visitor-geo.ts`).

Marketing y panel deben decir **mensajes de cliente**, no “conversaciones”, salvo que en el futuro cambiemos el contador.

Ejemplo orientativo (5 mensajes por chat de media):

| Plan | Tope mensajes | ≈ chats/mes (5 msg/chat) |
|------|---------------|---------------------------|
| Starter | 2 500 | ~500 |
| Growth | 12 000 | ~2 400 |
| Business | 50 000 | ~10 000 |

## Créditos por mensaje (por qué un chat “gasta mucho”)

Por cada mensaje del visitante, como mínimo suele haber:

1. **+3** créditos RAG (`RAG_METERING_CREDITS_PER_MESSAGE`)
2. **+N** créditos chat ≈ `creditsFromUsage` (prompt + respuesta × 4 en tokens)

Si el asistente llama herramientas (HTTP/MCP), **N** sube (más tokens y turnos internos).

Orden de magnitud (planificación, no SLA):

| Perfil | Créditos chat+RAG aprox. / mensaje visitante |
|--------|-----------------------------------------------|
| Respuesta corta, poco RAG | ~8–12 |
| Típico con documentos | ~14–20 |
| Respuesta larga + tools | ~25–40+ |

Starter: 2 500 msg × ~17 créditos ≈ **42k** → cupo 50k créditos suele ir junto al tope de mensajes.  
Si cada mensaje es “pesado”, puedes agotar **créditos antes** que mensajes → wallet o subir plan.

## Posicionamiento de volumen (honesto)

| Volumen | ¿Desk? |
|---------|--------|
| PYME / e-commerce / servicios (cientos–pocos miles de chats/mes) | **Sí** — planes actuales |
| Decenas de miles de chats/mes | **Business** + packs de créditos |
| Millones de mensajes / contact center masivo | **No es el target** — otro producto o enterprise custom |

Compites con Tidio/Crisp en **precio fijo + web**, no con Intercom+WhatsApp a escala global por resolución.

## Código

- `packages/platform-api/src/lib/usage.ts`
- `packages/runtime/src/do-usage.ts`
- Copy compartido: `packages/domain/src/usage-metering.ts`

## Evitar que un solo chat se coma el mes (estrategia)

| Capa | Qué hace hoy | Qué conviene añadir |
|------|----------------|---------------------|
| **Comercial** | Dos topes (mensajes + créditos) | Ratio plan ~18–20 créditos/mensaje presupuestado (ver tabla planes) |
| **Producto** | Barras en Facturación | Alerta email/panel al 80% de cada cupo |
| **Técnico** | Rate limit API público (abuso IP) | Tope **créditos por respuesta** (ej. 60–80) y/o **mensajes por conversación/día** (ej. 40) — hoy **no** está en código |
| **Abuso** | — | Un visitante no debería poder quemar 50k créditos en una sesión |

Diseño de cupos (presupuesto créditos ÷ mensajes ≈ créditos “promedio” por mensaje):

| Plan | Mensajes | Créditos | Presupuesto/msg |
|------|----------|----------|-----------------|
| Starter | 2 500 | 50 000 | **20** |
| Growth | 12 000 | 120 000 | **10** |
| Business | 50 000 | 480 000 | **9.6** |

Si el uso real es más pesado que el presupuesto, el cliente agota **créditos primero** → packs o subir plan. Starter es el más “holgado” por mensaje; Growth/Business asumen chats más eficientes o más wallet.

## Precio efectivo vs mercado (orientativo)

| Producto | Modelo | Orden de magnitud |
|----------|--------|-------------------|
| **Desk Starter** | Fijo + mensajes + créditos | ~**$0,036 / mensaje cliente** incluido (89÷2500) |
| **Desk Growth** | Idem | ~**$0,016 / mensaje** |
| **Desk Business** | Idem | ~**$0,012 / mensaje** |
| Tidio / Crisp | Fijo + conversaciones o seats | ~$25–60/mes + límites bajos en tier entrada |
| Intercom Fin | **$/asiento + ~$0,99/resolución** | Caro en volumen alto de resoluciones |
| Zendesk AI | **$/resolución** ~$1,50–2 | Variable, impredecible |

Desk **no compite** vendiendo “licencia de agente × 200 seats”. Compite en: **coste predecible por atención web** con datos reales. El comprador que busca “millones de mensajes” quiere **$/mensaje** bajo a escala — eso es **Business + enterprise** o no es fit.

## Qué subir en Creem (recomendación)

| Plan | Lista actual código | Acción |
|------|---------------------|--------|
| Starter | **$89** | Mantener o **$99** si el ICP es B2B; no bajar |
| Growth | **$189** | Ancla fuerte; opcional **$199** tras primeros clientes |
| Business | **$579** | Subir a **$599–649** solo con Ops mostrando margen >55% |

Subir precio **sin** subir mensajes si el margen aprieta; subir **créditos** solo si vendes packs o subes precio.
